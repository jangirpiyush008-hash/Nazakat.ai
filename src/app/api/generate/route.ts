import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCapabilities } from "@/config/features";
import { sparkCosts, videoDurations } from "@/config/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { falChains, submitWithFallback } from "@/server/media/fal";
import { mediaDurations, providerFor } from "@/server/media/provider";
import { spicyCreate, spicyInput, spicyModels } from "@/server/media/spicy";
import { buildMediaPrompt, checkPrompt } from "@/server/media/safety";
import { rateLimit, tooMany } from "@/server/rate-limit";
import { chargeSparks, refundSparks } from "@/server/sparks";

export const runtime = "nodejs";

const body = z.object({
  conversationId: z.string().uuid(),
  kind: z.enum(["image", "video"]),
  prompt: z.string().trim().min(2).max(500),
  /** Animate one of the user's own (already checked) photos. */
  sourceMediaId: z.string().uuid().optional(),
  duration: z.union(videoDurations.map((d) => z.literal(d)) as unknown as [z.ZodLiteral<5>, z.ZodLiteral<8>, z.ZodLiteral<10>, z.ZodLiteral<15>]).optional(),
});

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Starts a photo/video generation: validate → safety check → charge Sparks →
 * submit to fal.ai. The client then polls GET /api/generate/[id], which
 * finishes the job (store media, or refund on failure).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return fail(401, "unauthorized");

  const rl = rateLimit("generate", user.id);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid");
  const { conversationId, kind, prompt, sourceMediaId } = parsed.data;
  const duration = kind === "video" ? (parsed.data.duration ?? 5) : null;

  const caps = getCapabilities();
  const admin = createAdminClient();
  const provider = providerFor(kind);
  if (!admin || caps[kind] !== "available" || !provider) return fail(503, "unavailable");

  const { data: convo } = await supabase.from("conversations").select("id, companion_id").eq("id", conversationId).maybeSingle();
  if (!convo) return fail(404, "not_found");
  const [{ data: profile }, { data: companion }] = await Promise.all([
    supabase.from("profiles").select("onboarded_at").eq("id", user.id).single(),
    admin.from("companions").select("id, name, appearance, portrait_path").eq("id", convo.companion_id).single(),
  ]);
  if (!profile?.onboarded_at || !companion) return fail(403, "unauthorized");

  if (duration && !mediaDurations().includes(duration)) return fail(400, "duration_unavailable");
  const verdict = await checkPrompt(prompt, user.id);
  if (!verdict.ok) return NextResponse.json({ error: "blocked", reason: verdict.reason }, { status: 422 });

  const cost = kind === "image" ? sparkCosts.image : sparkCosts.video[duration as 5 | 8 | 10 | 15];
  // Image-to-video source: the user's own checked photo (RLS: owner only), else the companion portrait.
  let sourcePath: { bucket: string; path: string } | null = null;
  if (kind === "video" && sourceMediaId) {
    const { data: src } = await supabase.from("media_assets").select("storage_path, kind, companion_id").eq("id", sourceMediaId).maybeSingle();
    if (!src || src.kind !== "image" || src.companion_id !== companion.id) return fail(400, "invalid_source");
    sourcePath = { bucket: "generations", path: src.storage_path };
  } else if (kind === "video" && companion.portrait_path) {
    sourcePath = { bucket: "portraits", path: companion.portrait_path };
  }
  const facePath = kind === "image" ? companion.portrait_path : null;
  const chain = kind === "image" ? (facePath ? falChains.faceLocked() : falChains.image()) : sourcePath ? [...falChains.imageToVideo(), ...falChains.textToVideo()] : falChains.textToVideo();
  const model =
    provider === "spicy"
      ? kind === "image"
        ? facePath ? spicyModels.faceEdit() : spicyModels.textToImage()
        : sourcePath ? spicyModels.imageToVideo() : spicyModels.textToVideo()
      : (chain[0] ?? "unconfigured");

  const { data: job, error: jobError } = await admin
    .from("generation_jobs")
    .insert({ user_id: user.id, companion_id: companion.id, conversation_id: convo.id, kind, prompt, duration_s: duration, sparks_cost: cost, provider, model })
    .select("id")
    .single();
  if (jobError || !job) return fail(500, "failed");

  const charged = await chargeSparks(admin, user.id, cost, `job-${job.id}`, `${kind}:${job.id}`);
  if (!charged) {
    await admin.from("generation_jobs").update({ status: "canceled", error_code: "insufficient_sparks", finished_at: new Date().toISOString() }).eq("id", job.id);
    return fail(402, "insufficient_sparks");
  }

  try {
    const full = buildMediaPrompt(kind, companion.appearance, companion.name, prompt, Boolean(facePath));
    // Photos: edit the model's main portrait so the face never changes.
    const referenceImageUrl = facePath ? admin.storage.from("portraits").getPublicUrl(facePath).data.publicUrl : undefined;
    let startImage: string | undefined;
    if (sourcePath) {
      const { data: signed } = await admin.storage.from(sourcePath.bucket).createSignedUrl(sourcePath.path, 900);
      startImage = signed?.signedUrl;
    }
    if (provider === "spicy") {
      const input =
        kind === "image"
          ? referenceImageUrl ? spicyInput.faceEdit(full, referenceImageUrl) : spicyInput.image(full)
          : startImage ? spicyInput.imageToVideo(full, startImage, duration ?? 5) : spicyInput.textToVideo(full, duration ?? 5);
      // The job id doubles as the idempotency key, so a retry never pays twice.
      const { taskId } = await spicyCreate(model, input, job.id);
      const ref = `spicy:${taskId}`;
      await admin.from("generation_jobs").update({ status: "running", provider_request_id: taskId, status_url: ref, response_url: ref }).eq("id", job.id);
    } else {
      const sub = await submitWithFallback(kind, full, { duration: duration ?? undefined, startImageUrl: startImage, referenceImageUrl });
      await admin
        .from("generation_jobs")
        .update({ status: "running", model: sub.model, provider_request_id: sub.requestId, status_url: sub.statusUrl, response_url: sub.responseUrl })
        .eq("id", job.id);
    }
  } catch (err) {
    console.error("generate_submit_error", (err as Error).message);
    await refundSparks(admin, user.id, cost, `refund-${job.id}`, `${kind}:${job.id}`);
    await admin.from("generation_jobs").update({ status: "failed", error_code: "submit_failed", finished_at: new Date().toISOString() }).eq("id", job.id);
    return fail(502, "failed");
  }

  return NextResponse.json({ id: job.id, status: "running", cost });
}
