import "server-only";
import { z } from "zod";
import { completeText, parseJsonLoose } from "@/server/ai/llm";

const verdictSchema = z.object({ allowed: z.boolean(), reason: z.enum(["ok", "minor", "explicit", "real_person", "other"]) });

/**
 * Pre-generation prompt check. Hard rules (never relaxed): no sexual content
 * involving minors or minor-coded people, no explicit sexual content or nudity,
 * no real people. Glamour, romance, swimwear and lingerie are allowed.
 */
const minorTerms = /\b(child|children|kid|kids|minor|minors|underage|under[- ]?age|teen|teens|teenage|teenager|schoolgirl|schoolboy|school ?uniform|loli|lolita|shota|preteen|pre-teen|young girl|young boy|little girl|little boy|baby|toddler|1[0-7] ?(?:yo|y\/o|years? old))\b/i;
const explicitTerms = /\b(nude|nudes|naked|nsfw|porn|porno|pornographic|xxx|sex|sexual|intercourse|blowjob|orgasm|masturbat\w*|genital\w*|penis|vagina|pussy|dick|cock|nipple\w*|areola\w*|topless|bottomless|hentai|cum|erect\w*|explicit)\b/i;

export type SafetyVerdict = { ok: true } | { ok: false; reason: "minor" | "explicit" | "real_person" | "other" };

export async function checkPrompt(prompt: string, userId: string | null = null): Promise<SafetyVerdict> {
  if (minorTerms.test(prompt)) return { ok: false, reason: "minor" };
  if (explicitTerms.test(prompt)) return { ok: false, reason: "explicit" };

  try {
    const reply = await completeText({
      language: "english",
      userId,
      feature: "safety",
      maxTokens: 120,
      system:
        'You screen prompts for an adults-only AI companion app that generates images/videos of fictional adult characters. ALLOW: romance, flirting, glamour, fashion, swimwear, lingerie, sensual-but-clothed poses, kissing, dates, any normal scene. BLOCK as "minor": anything suggesting a person under 18 or child-like features in a romantic/sexual context. BLOCK as "explicit": nudity, exposed genitals/nipples, or sexual acts. BLOCK as "real_person": named real people, celebrities, politicians. BLOCK as "other": gore, extreme violence, hate symbols, illegal acts. Reply with ONLY JSON: {"allowed": true|false, "reason": "ok|minor|explicit|real_person|other"}',
      history: [{ role: "user", content: prompt }],
    });
    const v = parseJsonLoose(reply, verdictSchema);
    if (!v) return { ok: true }; // unparseable: keyword checks + provider/image checks still apply
    return v.allowed ? { ok: true } : { ok: false, reason: v.reason === "ok" ? "other" : v.reason };
  } catch {
    return { ok: true }; // classifier outage: keyword checks + image checks still apply
  }
}

/** Wraps the user's idea with the character's look and the non-negotiable guardrails. */
export function buildMediaPrompt(kind: "image" | "video", appearance: string | null, name: string, userPrompt: string, faceLocked = false) {
  const subject = faceLocked
    ? `Keep the exact same person from the reference photo: identical face, facial features, skin tone, hair and body (${name})`
    : appearance
      ? `${name}, ${appearance}`
      : `${name}, an adult Indian person in their late twenties`;
  const style =
    kind === "image"
      ? "photorealistic photo, natural skin texture, shallow depth of field, warm rim light, high detail, tasteful, adult, fully clothed or swimwear/lingerie at most, no nudity"
      : "cinematic vertical video, smooth natural motion, warm lighting, tasteful, adult, fully clothed or swimwear/lingerie at most, no nudity";
  return `${subject}. ${sceneFrom(kind, userPrompt)}. ${style}.`;
}

/** Turns a chat request ("can you send me a selfie please") into a scene description. */
function sceneFrom(kind: "image" | "video", text: string) {
  const scene = text
    .replace(/\b(can|could|will|would) (you|u)\b|\bplease\b|\bplz\b|\b(send|show|share|give|click|take|make|record|bhejo|bhej|dikhao|dikha)( me| mujhe)?\b|\b(i )?(want|wanna|need) (to see )?\b|\b(a|an|one|your|ur|apni|apna)\b|\b(pic|pics|photo|photos|picture|image|snap|tasveer)\b|\b(video|vid|clip|reel)\b|[?!.]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = kind === "image" ? "a natural selfie-style photo, looking at the camera with a warm smile" : "a short natural clip, looking at the camera, smiling and waving";
  return scene.length > 3 ? `${base}, ${scene}` : base;
}
