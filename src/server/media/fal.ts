import "server-only";

/**
 * fal.ai queue API (https://fal.ai/docs/model-apis/model-endpoints/queue).
 * Submit returns status/response URLs that we store and poll. Model order is
 * configurable; on a submit failure the next model is tried. Provider safety
 * checkers stay ON.
 */
const QUEUE = "https://queue.fal.run";

type ModelSpec = {
  /** Lengths in seconds this model can produce (videos only). */
  durations?: readonly number[];
  build: (prompt: string, opts: { duration?: number; startImageUrl?: string; referenceImageUrl?: string }) => Record<string, unknown>;
};

const NEGATIVE = "nudity, explicit, minor, child, blur, distort, low quality";

const flux: ModelSpec = {
  build: (prompt) => ({ prompt, image_size: "portrait_4_3", num_images: 1, enable_safety_checker: true, output_format: "jpeg" }),
};

/** Known models and how to call them. Add a model here to make it selectable via env. */
export const modelSpecs: Record<string, ModelSpec> = {
  "fal-ai/flux/dev": flux,
  "fal-ai/flux/schnell": flux,
  /** Edits the model's main portrait, so the face stays the same in every new photo. */
  "fal-ai/flux-pro/kontext": {
    build: (prompt, { referenceImageUrl }) => ({ prompt, image_url: referenceImageUrl, aspect_ratio: "3:4", num_images: 1, output_format: "jpeg", safety_tolerance: "2" }),
  },
  "fal-ai/kling-video/v3/pro/text-to-video": {
    durations: [5, 8, 10, 15],
    build: (prompt, { duration }) => ({ prompt, duration: String(duration ?? 5), aspect_ratio: "9:16", negative_prompt: NEGATIVE, generate_audio: true, enable_safety_checker: true }),
  },
  "fal-ai/kling-video/v3/pro/image-to-video": {
    durations: [5, 8, 10, 15],
    build: (prompt, { duration, startImageUrl }) => ({ prompt, start_image_url: startImageUrl, duration: String(duration ?? 5), negative_prompt: NEGATIVE, generate_audio: true, enable_safety_checker: true }),
  },
  "fal-ai/bytedance/seedance/v1/pro/text-to-video": {
    durations: [5, 8, 10],
    build: (prompt, { duration }) => ({ prompt, duration: String(duration ?? 5), aspect_ratio: "9:16", resolution: "720p", enable_safety_checker: true }),
  },
};

const list = (raw: string | undefined, fallback: string) => (raw || fallback).split(",").map((s) => s.trim()).filter((m) => m in modelSpecs);

export const falChains = {
  image: () => list(process.env.FAL_IMAGE_MODELS, "fal-ai/flux/dev,fal-ai/flux/schnell"),
  /** Used when the model has a main portrait (locked face). */
  faceLocked: () => list(process.env.FAL_FACE_MODELS, "fal-ai/flux-pro/kontext"),
  textToVideo: () => list(process.env.FAL_VIDEO_MODELS, "fal-ai/kling-video/v3/pro/text-to-video,fal-ai/bytedance/seedance/v1/pro/text-to-video"),
  imageToVideo: () => list(process.env.FAL_I2V_MODELS, "fal-ai/kling-video/v3/pro/image-to-video"),
};

function headers() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY missing");
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" };
}

export class FalError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export type Submitted = { model: string; requestId: string; statusUrl: string; responseUrl: string };

async function submitOne(model: string, input: Record<string, unknown>): Promise<Submitted> {
  const res = await fetch(`${QUEUE}/${model}`, { method: "POST", headers: headers(), body: JSON.stringify(input) });
  if (!res.ok) throw new FalError(`submit ${model} ${res.status}`, res.status);
  const j = (await res.json()) as { request_id: string; status_url: string; response_url: string };
  return { model, requestId: j.request_id, statusUrl: j.status_url, responseUrl: j.response_url };
}

/** Tries each model in the chain that supports the request; returns the first accepted submission. */
export async function submitWithFallback(kind: "image" | "video", prompt: string, opts: { duration?: number; startImageUrl?: string; referenceImageUrl?: string } = {}) {
  // With a face reference we never fall back to text-only models: the face must stay locked.
  const chain = kind === "image" ? (opts.referenceImageUrl ? falChains.faceLocked() : falChains.image()) : opts.startImageUrl ? [...falChains.imageToVideo(), ...falChains.textToVideo()] : falChains.textToVideo();
  const eligible = chain.filter((m) => kind === "image" || !opts.duration || modelSpecs[m].durations?.includes(opts.duration));
  let lastError: unknown = new Error(`no ${kind} model supports this request`);
  for (const model of eligible) {
    try {
      const isI2V = model.includes("image-to-video");
      return await submitOne(model, modelSpecs[model].build(prompt, { duration: opts.duration, startImageUrl: isI2V ? opts.startImageUrl : undefined, referenceImageUrl: opts.referenceImageUrl }));
    } catch (err) {
      lastError = err;
      console.error("fal_submit_failed", model, (err as Error).message);
      // Client errors (bad input) won't succeed elsewhere either, except 401/403/429 which are account-level.
      if (err instanceof FalError && err.status >= 400 && err.status < 500 && ![401, 403, 404, 429].includes(err.status)) break;
    }
  }
  throw lastError;
}

export type FalStatus = { status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED"; error?: string; queue_position?: number };

export async function status(statusUrl: string): Promise<FalStatus> {
  const res = await fetch(statusUrl, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new FalError(`status ${res.status}`, res.status);
  return (await res.json()) as FalStatus;
}

export async function result<T>(responseUrl: string): Promise<T> {
  const res = await fetch(responseUrl, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new FalError(`result ${res.status}`, res.status);
  return (await res.json()) as T;
}

/** Video lengths at least one configured model can make. */
export function availableDurations() {
  const all = new Set<number>();
  for (const m of [...falChains.textToVideo(), ...falChains.imageToVideo()]) modelSpecs[m].durations?.forEach((d) => all.add(d));
  return [5, 8, 10, 15].filter((d) => all.has(d));
}

export type ImageResult = { images: { url: string; width: number; height: number; content_type?: string }[]; has_nsfw_concepts?: boolean[] };
export type VideoResult = { video: { url: string; content_type?: string } };
