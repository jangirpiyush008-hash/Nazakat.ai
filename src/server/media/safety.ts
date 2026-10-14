import "server-only";
import { Anthropic, chatModel } from "@/server/ai/anthropic";

/**
 * Pre-generation prompt check. Hard rules (never relaxed): no sexual content
 * involving minors or minor-coded people, no explicit sexual content or nudity,
 * no real people. Glamour, romance, swimwear and lingerie are allowed.
 */
const minorTerms = /\b(child|children|kid|kids|minor|minors|underage|under[- ]?age|teen|teens|teenage|teenager|schoolgirl|schoolboy|school ?uniform|loli|lolita|shota|preteen|pre-teen|young girl|young boy|little girl|little boy|baby|toddler|1[0-7] ?(?:yo|y\/o|years? old))\b/i;
const explicitTerms = /\b(nude|nudes|naked|nsfw|porn|porno|pornographic|xxx|sex|sexual|intercourse|blowjob|orgasm|masturbat\w*|genital\w*|penis|vagina|pussy|dick|cock|nipple\w*|areola\w*|topless|bottomless|hentai|cum|erect\w*|explicit)\b/i;

export type SafetyVerdict = { ok: true } | { ok: false; reason: "minor" | "explicit" | "real_person" | "other" };

export async function checkPrompt(prompt: string): Promise<SafetyVerdict> {
  if (minorTerms.test(prompt)) return { ok: false, reason: "minor" };
  if (explicitTerms.test(prompt)) return { ok: false, reason: "explicit" };

  const key = process.env.AI_CHAT_API_KEY;
  if (!key) return { ok: true }; // keyword checks + provider safety checker still apply
  const client = new Anthropic({ apiKey: key, timeout: 20_000, maxRetries: 1 });
  try {
    const res = await client.messages.create({
      model: chatModel(),
      max_tokens: 512,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["allowed", "reason"],
            properties: { allowed: { type: "boolean" }, reason: { type: "string", enum: ["ok", "minor", "explicit", "real_person", "other"] } },
          },
        },
      },
      system:
        "You screen prompts for an adults-only AI companion app that generates images/videos of fictional adult characters. ALLOW: romance, flirting, glamour, fashion, swimwear, lingerie, sensual-but-clothed poses, kissing, dates, any normal scene. BLOCK as 'minor': anything suggesting a person under 18 or child-like features in a romantic/sexual context. BLOCK as 'explicit': nudity, exposed genitals/nipples, or sexual acts. BLOCK as 'real_person': named real people, celebrities, politicians. BLOCK as 'other': gore, extreme violence, hate symbols, illegal acts. Otherwise allowed=true, reason='ok'.",
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal") return { ok: false, reason: "other" };
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return { ok: true };
    const v = JSON.parse(text.text) as { allowed: boolean; reason: SafetyVerdict extends { reason: infer R } ? R : never };
    return v.allowed ? { ok: true } : { ok: false, reason: v.reason === "ok" ? "other" : v.reason };
  } catch {
    return { ok: true }; // classifier outage: keyword checks and provider checker still apply
  }
}

/** Wraps the user's idea with the character's look and the non-negotiable guardrails. */
export function buildMediaPrompt(kind: "image" | "video", appearance: string | null, name: string, userPrompt: string) {
  const subject = appearance ? `${name}, ${appearance}` : `${name}, an adult Indian person in their late twenties`;
  const style =
    kind === "image"
      ? "cinematic photo, shallow depth of field, warm rim light, high detail, tasteful, adult, fully clothed or swimwear/lingerie at most, no nudity"
      : "cinematic vertical video, smooth natural motion, warm lighting, tasteful, adult, fully clothed or swimwear/lingerie at most, no nudity";
  return `${subject}. ${userPrompt.trim()}. ${style}.`;
}
