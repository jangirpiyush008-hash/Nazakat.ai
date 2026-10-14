import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCapabilities } from "@/config/features";
import { sparkCosts, videoDurations } from "@/config/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { falModels, imageInput, submit, videoInput } from "@/server/media/fal";
import { buildMediaPrompt, checkPrompt } from "@/server/media/safety";
import { chargeSparks, refundSparks } from "@/server/sparks";

export const runtime = "nodejs";

const body = z.object({
  conversationId: z.string().uuid(),
  kind: z.enum(["image", "video"]),
  prompt: z.string().trim().min(2).max(500),
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

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid");
  const { conversationId, kind, prompt } = parsed.data;
  const duration = kind === "video" ? (parsed.data.duration ?? 5) : null;

  const caps = getCapabilities();
  const admin = createAdminClient();
  if (!admin || caps[kind] !== "available") return fail(503, "unavailable");

  const { data: convo } = await supabase.from("conversations").select("id, companion_id").eq("id", conversationId).maybeSingle();
  if (!convo) return fail(404, "not_found");
  const [{ data: profile }, { data: companion }] = await Promise.all([
    supabase.from("profiles").select("onboarded_at").eq("id", user.id).single(),
    admin.from("companions").select("id, name, appearance, portrait_path").eq("id", convo.companion_id).single(),
  ]);
  if (!profile?.onboarded_at || !companion) return fail(403, "unauthorized");

  const verdict = await checkPrompt(prompt);
  if (!verdict.ok) return NextResponse.json({ error: "blocked", reason: verdict.reason }, { status: 422 });

  const cost = kind === "image" ? sparkCosts.image : sparkCosts.video[duration as 5 | 8 | 10 | 15];
  const model = kind === "image" ? falModels.image : companion.portrait_path ? falModels.imageToVideo : falModels.textToVideo;

  const { data: job, error: jobError } = await admin
    .from("generation_jobs")
    .insert({ user_id: user.id, companion_id: companion.id, conversation_id: convo.id, kind, prompt, duration_s: duration, sparks_cost: cost, provider: "fal", model })
    .select("id")
    .single();
  if (jobError || !job) return fail(500, "failed");

  const charged = await chargeSparks(admin, user.id, cost, `job-${job.id}`, `${kind}:${job.id}`);
  if (!charged) {
    await admin.from("generation_jobs").update({ status: "canceled", error_code: "insufficient_sparks", finished_at: new Date().toISOString() }).eq("id", job.id);
    return fail(402, "insufficient_sparks");
  }

  try {
    const full = buildMediaPrompt(kind, companion.appearance, companion.name, prompt);
    let startImage: string | undefined;
    if (kind === "video" && companion.portrait_path) {
      const { data: signed } = await admin.storage.from("portraits").createSignedUrl(companion.portrait_path, 600);
      startImage = signed?.signedUrl;
    }
    const sub = await submit(model, kind === "image" ? imageInput(full) : videoInput(full, duration!, startImage));
    await admin
      .from("generation_jobs")
      .update({ status: "running", provider_request_id: sub.requestId, status_url: sub.statusUrl, response_url: sub.responseUrl })
      .eq("id", job.id);
  } catch (err) {
    console.error("generate_submit_error", (err as Error).message);
    await refundSparks(admin, user.id, cost, `refund-${job.id}`, `${kind}:${job.id}`);
    await admin.from("generation_jobs").update({ status: "failed", error_code: "submit_failed", finished_at: new Date().toISOString() }).eq("id", job.id);
    return fail(502, "failed");
  }

  return NextResponse.json({ id: job.id, status: "running", cost });
}
