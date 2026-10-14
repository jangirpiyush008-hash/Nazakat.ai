import "server-only";
import { z } from "zod";
import { llmCost } from "@/config/costs";
import { Anthropic } from "@/server/ai/anthropic";
import { trackUsage } from "@/server/usage";

/**
 * Looks at every generated photo before a user sees it (Claude Haiku vision).
 * Allowed: glamour, fashion, swimwear, lingerie, romance, clothed sensual poses.
 * Blocked: nudity or sexual acts, anyone who looks under 18, gore, hate symbols.
 */
/** Claude Haiku directly (Anthropic key) or the same model through SpicyAPI (no Anthropic key needed). */
const via = (): "anthropic" | "spicy" | null => {
  const want = process.env.IMAGE_CHECK_PROVIDER;
  if (want !== "spicy" && process.env.AI_CHAT_API_KEY) return "anthropic";
  if (want !== "anthropic" && process.env.SPICYAPI_API_KEY) return "spicy";
  return null;
};
export const imageCheckConfigured = () => via() !== null;
const model = () => process.env.IMAGE_CHECK_MODEL || "claude-haiku-5-5";
const spicyModel = () => process.env.SPICY_IMAGE_CHECK_MODEL || "anthropic/claude-haiku-5.5/chat";

const RULES =
  "You review AI-generated images for an adults-only companion app before users see them. ALLOW: glamour, fashion, swimwear, lingerie, cleavage, romance, kissing, clothed sensual poses. BLOCK as 'nudity': exposed genitals, exposed nipples, or fully nude bodies. BLOCK as 'sexual': depicted sexual acts. BLOCK as 'minor': any person who could plausibly be under 18 (childlike face or body, school uniform) in a romantic, revealing or sexual context, or any child at all in swimwear/lingerie. BLOCK as 'violence': gore. BLOCK as 'other': hate symbols. When unsure about age, block as 'minor'.";

const verdict = z.object({ allowed: z.boolean(), reason: z.enum(["ok", "nudity", "sexual", "minor", "violence", "other"]) });
export type ImageVerdict = { ok: true } | { ok: false; reason: string } | { ok: null; reason: "unavailable" };

export async function checkImage(url: string, userId: string | null): Promise<ImageVerdict> {
  const provider = via();
  if (!provider) return { ok: null, reason: "unavailable" };
  if (provider === "spicy") return checkViaSpicy(url, userId);
  try {
    const client = new Anthropic({ apiKey: process.env.AI_CHAT_API_KEY!, timeout: 30_000, maxRetries: 1 });
    const res = await client.messages.create({
      model: model(),
      max_tokens: 400,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["allowed", "reason"],
            properties: { allowed: { type: "boolean" }, reason: { type: "string", enum: ["ok", "nudity", "sexual", "minor", "violence", "other"] } },
          },
        },
      },
      system: RULES,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "url", url } }, { type: "text", text: "Review this image." }] }],
    });
    trackUsage({ userId, feature: "safety", provider: "anthropic", model: res.model, units: res.usage.input_tokens + res.usage.output_tokens, unit: "tokens", costUsd: llmCost(res.model, res.usage.input_tokens, res.usage.output_tokens) });
    if (res.stop_reason === "refusal") return { ok: false, reason: "other" };
    const text = res.content.find((b) => b.type === "text");
    const parsed = text && text.type === "text" ? verdict.safeParse(JSON.parse(text.text)) : null;
    if (!parsed?.success) return { ok: null, reason: "unavailable" };
    return parsed.data.allowed ? { ok: true } : { ok: false, reason: parsed.data.reason };
  } catch (err) {
    console.error("image_check_error", (err as Error).message.slice(0, 120));
    return { ok: null, reason: "unavailable" };
  }
}

/** SpicyAPI's OpenAI-format endpoint; JSON comes back as text, so it is parsed strictly. */
async function checkViaSpicy(url: string, userId: string | null): Promise<ImageVerdict> {
  try {
    const res = await fetch("https://api.spicyapi.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SPICYAPI_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: spicyModel(),
        max_tokens: 200,
        messages: [
          { role: "system", content: `${RULES} Reply with ONLY this JSON and nothing else: {"allowed": true|false, "reason": "ok|nudity|sexual|minor|violence|other"}` },
          { role: "user", content: [{ type: "image_url", image_url: { url } }, { type: "text", text: "Review this image." }] },
        ],
      }),
    });
    if (!res.ok) throw new Error(`spicy check ${res.status}`);
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = j.choices?.[0]?.message?.content ?? "";
    const tokensIn = j.usage?.prompt_tokens ?? 0;
    const tokensOut = j.usage?.completion_tokens ?? 0;
    trackUsage({ userId, feature: "safety", provider: "spicy", model: spicyModel(), units: tokensIn + tokensOut, unit: "tokens", costUsd: (tokensIn * 0.1 + tokensOut * 0.5) / 1e6 });
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? verdict.safeParse(JSON.parse(match[0])) : null;
    if (!parsed?.success) return { ok: null, reason: "unavailable" };
    return parsed.data.allowed ? { ok: true } : { ok: false, reason: parsed.data.reason };
  } catch (err) {
    console.error("image_check_error", (err as Error).message.slice(0, 120));
    return { ok: null, reason: "unavailable" };
  }
}

/**
 * Providers whose own safety checker we trust as a fallback when our check is
 * unavailable. Anything else (e.g. SpicyAPI) is blocked unless our check passes.
 */
export const providerHasOwnSafetyChecker = (provider: string) => provider === "fal";
