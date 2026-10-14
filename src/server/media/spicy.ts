import "server-only";

/**
 * SpicyAPI native task API (https://docs.spicyapi.ai/docs):
 * POST /jobs/createTask {model, input} → taskId; GET /jobs/recordInfo?taskId= → state.
 * Envelope: {code, msg, data}; branch on `code`, not HTTP status.
 * Result links expire after ~20 minutes, so finished files are copied to our storage.
 */
const API = "https://api.spicyapi.ai/api/v1";

export const spicyConfigured = () => Boolean(process.env.SPICYAPI_API_KEY);

/** Models we call, overridable by env. Non-"spicy" variants: our content stays non-explicit. */
export const spicyModels = {
  textToImage: () => process.env.SPICY_IMAGE_MODEL || "bytedance/seedream-5.0-pro/text-to-image",
  /** Edits the companion's main portrait so the face stays locked. */
  faceEdit: () => process.env.SPICY_FACE_MODEL || "bytedance/seedream-5.0-pro/edit",
  imageToVideo: () => process.env.SPICY_I2V_MODEL || "kling/3.0/image-to-video",
  textToVideo: () => process.env.SPICY_T2V_MODEL || "kling/3.0/text-to-video",
};

/** Kling 3.0 takes any whole length from 3 to 15 seconds. */
export const spicyDurations = [5, 8, 10, 15] as const;

export class SpicyError extends Error {
  constructor(message: string, public code: number) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.SPICYAPI_API_KEY;
  if (!key) throw new SpicyError("SPICYAPI_API_KEY missing", 0);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { code: number; msg: string; data: T } | null;
  if (!body || body.code !== 200) throw new SpicyError(`spicy ${path.split("?")[0]} ${body?.code ?? res.status} ${body?.msg ?? ""}`.trim(), body?.code ?? res.status);
  return body.data;
}

export async function spicyCreate(model: string, input: Record<string, unknown>, idempotencyKey: string = crypto.randomUUID()) {
  const data = await call<{ taskId: string; state: string; estimatedCost?: string }>("/jobs/createTask", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ model, input }),
  });
  return { taskId: data.taskId, estimatedCost: Number(data.estimatedCost ?? 0) };
}

export type SpicyTask =
  | { state: "running" }
  | { state: "succeeded"; url: string; mime: string | null; cost: number }
  | { state: "failed"; code: string };

export async function spicyStatus(taskId: string): Promise<SpicyTask> {
  const t = await call<{
    state: string;
    cost?: string;
    errorCode?: string;
    output?: { assets?: { url?: string; mime?: string; pending?: boolean }[] };
  }>(`/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
  if (t.state === "queued" || t.state === "running") return { state: "running" };
  if (t.state === "succeeded") {
    const asset = t.output?.assets?.find((a) => a.url);
    if (asset?.url) return { state: "succeeded", url: asset.url, mime: asset.mime ?? null, cost: Number(t.cost ?? 0) };
    if (t.output?.assets?.some((a) => a.pending)) return { state: "running" };
    return { state: "failed", code: "empty_result" };
  }
  return { state: "failed", code: t.errorCode || t.state };
}

/** Builds the model input for each kind of request. */
export const spicyInput = {
  image: (prompt: string) => ({ prompt, aspect_ratio: "3:4", resolution: "2k", output_format: "jpeg" }),
  faceEdit: (prompt: string, referenceUrl: string) => ({ prompt, image_urls: [referenceUrl], aspect_ratio: "3:4", resolution: "2k", output_format: "jpeg" }),
  imageToVideo: (prompt: string, imageUrl: string, seconds: number) => ({
    prompt,
    image_url: imageUrl,
    duration_seconds: seconds,
    resolution: "720p",
    generate_audio: true,
    negative_prompt: "nudity, explicit, minor, child, blur, distortion, low quality",
  }),
  textToVideo: (prompt: string, seconds: number) => ({
    prompt,
    duration_seconds: seconds,
    aspect_ratio: "9:16",
    resolution: "720p",
    generate_audio: true,
    negative_prompt: "nudity, explicit, minor, child, blur, distortion, low quality",
  }),
};
