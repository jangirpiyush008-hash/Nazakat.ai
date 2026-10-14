import "server-only";

/**
 * Sliding-window rate limiter kept in process memory. Good for a single
 * Railway instance; move to Redis (e.g. Upstash) before running several.
 */
const hits = new Map<string, number[]>();

export const limits = {
  chat: { max: 30, windowMs: 60_000 },
  generate: { max: 6, windowMs: 60_000 },
  voiceNote: { max: 20, windowMs: 60_000 },
  callTurn: { max: 40, windowMs: 60_000 },
  callStart: { max: 5, windowMs: 60_000 },
} as const;

export function rateLimit(name: keyof typeof limits, userId: string) {
  const { max, windowMs } = limits[name];
  const key = `${name}:${userId}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 50_000) hits.clear(); // crude memory bound
  return { ok: true, retryAfter: 0 };
}

export function tooMany(retryAfter: number) {
  return Response.json({ error: "rate_limited", retryAfter }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}
