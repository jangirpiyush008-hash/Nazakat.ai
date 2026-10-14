import "server-only";
import { availableDurations as falDurations } from "./fal";
import { imageCheckConfigured } from "./image-check";
import { spicyConfigured, spicyDurations } from "./spicy";

/** Which service makes photos/videos: MEDIA_PROVIDER=spicy|fal, else SpicyAPI when its key is set. */
export function mediaProvider(): "spicy" | "fal" | null {
  const want = process.env.MEDIA_PROVIDER;
  if (want === "fal") return process.env.FAL_KEY ? "fal" : null;
  if (want === "spicy" || !want) {
    if (spicyConfigured()) return "spicy";
    return process.env.FAL_KEY ? "fal" : null;
  }
  return null;
}

export function mediaDurations(): number[] {
  return mediaProvider() === "spicy" ? [...spicyDurations] : falDurations();
}

/** Photos from SpicyAPI need our image check; without it, fall back to fal (which has its own checker). */
export function providerFor(kind: "image" | "video"): "spicy" | "fal" | null {
  const p = mediaProvider();
  if (kind === "image" && p === "spicy" && !imageCheckConfigured()) return process.env.FAL_KEY ? "fal" : null;
  return p;
}
