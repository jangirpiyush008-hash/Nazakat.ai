import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkImage, providerHasOwnSafetyChecker } from "@/server/media/image-check";
import { result, status, type ImageResult, type VideoResult } from "@/server/media/fal";
import { unitCosts } from "@/config/costs";
import { refundSparks } from "@/server/sparks";
import { trackUsage } from "@/server/usage";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = Promise<{ id: string }>;
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Polled by the client. Advances a running job: when fal finishes, downloads
 * the file into private storage, records the media, posts it into the chat as
 * a companion message, and settles Sparks (refund on failure or block).
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS: only the owner can see the job.
  const { data: job } = await supabase.from("generation_jobs").select("*").eq("id", id).maybeSingle();
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  if (job.status === "succeeded" && job.media_id) return NextResponse.json(await done(admin, job.id, job.media_id));
  if (job.status !== "running" || !job.status_url || !job.response_url) {
    return NextResponse.json({ id: job.id, status: job.status, error: job.error_code });
  }

  let st;
  try {
    st = await status(job.status_url);
  } catch {
    return NextResponse.json({ id: job.id, status: "running" });
  }
  if (st.status !== "COMPLETED") return NextResponse.json({ id: job.id, status: "running", queue: st.queue_position ?? null });

  // Claim the job so parallel polls don't finish it twice.
  const { data: claimed } = await admin.from("generation_jobs").update({ status: "finishing" }).eq("id", job.id).eq("status", "running").select("id");
  if (!claimed?.length) return NextResponse.json({ id: job.id, status: "running" });

  const failJob = async (code: string, state: "failed" | "blocked" = "failed") => {
    await refundSparks(admin, job.user_id, job.sparks_cost, `refund-${job.id}`, `${job.kind}:${job.id}`);
    await admin.from("generation_jobs").update({ status: state, error_code: code, finished_at: new Date().toISOString() }).eq("id", job.id);
    return NextResponse.json({ id: job.id, status: state, error: code, refunded: job.sparks_cost });
  };

  if (st.error) return failJob("provider_error");

  try {
    let fileUrl: string;
    let width: number | null = null;
    let height: number | null = null;
    if (job.kind === "image") {
      const r = await result<ImageResult>(job.response_url);
      if (r.has_nsfw_concepts?.some(Boolean)) return failJob("safety_blocked", "blocked");
      const img = r.images?.[0];
      if (!img) return failJob("empty_result");
      fileUrl = img.url;
      width = img.width;
      height = img.height;
      // Our own check on the finished photo, before it is stored or shown.
      const check = await checkImage(img.url, job.user_id);
      if (check.ok === false) return failJob(`image_check_${check.reason}`, "blocked");
      if (check.ok === null && !providerHasOwnSafetyChecker(job.provider)) return failJob("image_check_unavailable", "blocked");
    } else {
      const r = await result<VideoResult>(job.response_url);
      if (!r.video?.url) return failJob("empty_result");
      fileUrl = r.video.url;
    }

    const file = await fetch(fileUrl);
    if (!file.ok) return failJob("download_failed");
    const contentType = file.headers.get("content-type") ?? (job.kind === "image" ? "image/jpeg" : "video/mp4");
    const ext = job.kind === "image" ? (contentType.includes("png") ? "png" : "jpg") : "mp4";
    const path = `${job.user_id}/${job.id}.${ext}`;
    const { error: upErr } = await admin.storage.from("generations").upload(path, await file.arrayBuffer(), { contentType, upsert: true });
    if (upErr) return failJob("storage_failed");

    const { data: media } = await admin
      .from("media_assets")
      .insert({ user_id: job.user_id, companion_id: job.companion_id, kind: job.kind, storage_path: path, content_type: contentType, width, height, duration_s: job.duration_s, prompt: job.prompt })
      .select("id")
      .single();
    if (!media) return failJob("storage_failed");

    if (job.conversation_id) {
      await admin.from("messages").insert({
        conversation_id: job.conversation_id,
        user_id: job.user_id,
        role: "assistant",
        content: job.kind === "image" ? "📷 Photo" : `🎬 Video · ${job.duration_s}s`,
        media_id: media.id,
        provider: "fal",
        model: job.model,
        provider_request_id: job.provider_request_id,
      });
      await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", job.conversation_id);
    }
    await admin.from("generation_jobs").update({ status: "succeeded", media_id: media.id, finished_at: new Date().toISOString() }).eq("id", job.id);
    trackUsage(
      job.kind === "image"
        ? { userId: job.user_id, feature: "image", provider: "fal", model: job.model, units: 1, unit: "image", costUsd: unitCosts.imagePerImage[job.model] ?? 0.03 }
        : { userId: job.user_id, feature: "video", provider: "fal", model: job.model, units: job.duration_s ?? 0, unit: "seconds", costUsd: (job.duration_s ?? 0) * (unitCosts.videoPerSecond[job.model] ?? 0.1) },
    );
    return NextResponse.json(await done(admin, job.id, media.id));
  } catch (err) {
    console.error("generate_finish_error", (err as Error).message);
    return failJob("failed");
  }
}

async function done(admin: NonNullable<ReturnType<typeof createAdminClient>>, jobId: string, mediaId: string) {
  const { data: media } = await admin.from("media_assets").select("id, kind, storage_path, duration_s").eq("id", mediaId).single();
  const { data: signed } = media ? await admin.storage.from("generations").createSignedUrl(media.storage_path, SIGNED_URL_SECONDS) : { data: null };
  return { id: jobId, status: "succeeded", media: media && { id: media.id, kind: media.kind, url: signed?.signedUrl ?? null, duration: media.duration_s } };
}
