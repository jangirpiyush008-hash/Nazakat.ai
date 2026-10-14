import "server-only";

/**
 * fal.ai queue API (https://fal.ai/docs/model-apis/model-endpoints/queue).
 * Submit returns status/response URLs that we store and poll; no webhook needed.
 * Safety checkers stay ON (disabling them needs fal account authorisation anyway).
 */
const QUEUE = "https://queue.fal.run";

export const falModels = {
  image: process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev",
  textToVideo: process.env.FAL_VIDEO_MODEL || "fal-ai/kling-video/v3/pro/text-to-video",
  imageToVideo: process.env.FAL_I2V_MODEL || "fal-ai/kling-video/v3/pro/image-to-video",
};

function headers() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY missing");
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" };
}

export type Submitted = { requestId: string; statusUrl: string; responseUrl: string };

export async function submit(model: string, input: Record<string, unknown>): Promise<Submitted> {
  const res = await fetch(`${QUEUE}/${model}`, { method: "POST", headers: headers(), body: JSON.stringify(input) });
  if (!res.ok) throw new FalError(`submit ${res.status}`, res.status);
  const j = (await res.json()) as { request_id: string; status_url: string; response_url: string };
  return { requestId: j.request_id, statusUrl: j.status_url, responseUrl: j.response_url };
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

export class FalError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function imageInput(prompt: string) {
  return { prompt, image_size: "portrait_4_3", num_images: 1, enable_safety_checker: true, output_format: "jpeg" };
}

export function videoInput(prompt: string, duration: number, startImageUrl?: string) {
  return {
    prompt,
    duration: String(duration),
    negative_prompt: "nudity, explicit, minor, child, blur, distort, low quality",
    generate_audio: true,
    enable_safety_checker: true,
    ...(startImageUrl ? { start_image_url: startImageUrl } : { aspect_ratio: "9:16" }),
  };
}

export type ImageResult = { images: { url: string; width: number; height: number; content_type?: string }[]; has_nsfw_concepts?: boolean[] };
export type VideoResult = { video: { url: string; content_type?: string } };
