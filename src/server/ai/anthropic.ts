import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

let client: Anthropic | null = null;
function getClient() {
  const apiKey = process.env.AI_CHAT_API_KEY;
  if (!apiKey) return null;
  client ??= new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 });
  return client;
}

export const chatModel = () => process.env.AI_CHAT_MODEL || "claude-opus-5-5";

export type Turn = { role: "user" | "assistant"; content: string };

/**
 * Streams a companion reply. Opus 5.5 always thinks; chat runs at low effort for
 * latency. `fallbacks: "default"` re-runs a safety-declined request on
 * Anthropic's recommended model server-side instead of returning a refusal.
 */
export function streamReply(opts: { system: string; persona: string; history: Turn[]; context: string; signal?: AbortSignal }) {
  const anthropic = getClient();
  if (!anthropic) return null;
  const messages = [
    ...opts.history.map((t) => ({ role: t.role, content: t.content })),
    // Per-user context after the cached prefix: operator channel, not user text.
    { role: "system" as const, content: opts.context },
  ];
  return anthropic.beta.messages.stream(
    {
      model: chatModel(),
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: opts.system },
        { type: "text", text: opts.persona, cache_control: { type: "ephemeral" } },
      ],
      messages,
    },
    { signal: opts.signal },
  );
}

/** Short non-streaming reply for voice calls (spoken aloud, so 1–2 sentences). */
export async function replyOnce(opts: { system: string; persona: string; history: Turn[]; context: string }) {
  const anthropic = getClient();
  if (!anthropic) return null;
  const res = await anthropic.beta.messages.create({
    model: chatModel(),
    max_tokens: 1024,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [
      { type: "text", text: opts.system },
      { type: "text", text: opts.persona, cache_control: { type: "ephemeral" } },
    ],
    messages: [...opts.history.map((t) => ({ role: t.role, content: t.content })), { role: "system" as const, content: opts.context }],
  });
  if (res.stop_reason === "refusal") return null;
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ").trim();
}

const memorySchema = z.object({
  memories: z
    .array(z.object({ fact: z.string().min(2).max(200), category: z.enum(["preference", "place", "name", "date", "other"]) }))
    .max(3),
});

/**
 * Pulls 0–3 durable, non-sensitive facts out of the latest user message.
 * Skips health, sexuality, religion, caste, politics, finances and anything
 * about third parties — DPDP data minimisation.
 */
export async function extractMemories(userText: string, known: string[]) {
  const anthropic = getClient();
  if (!anthropic || userText.trim().length < 12) return [];
  const res = await anthropic.messages.create({
    model: chatModel(),
    max_tokens: 1024,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["memories"],
          properties: {
            memories: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["fact", "category"],
                properties: {
                  fact: { type: "string" },
                  category: { type: "string", enum: ["preference", "place", "name", "date", "other"] },
                },
              },
            },
          },
        },
      },
    },
    system:
      "Extract at most 3 short, durable facts the user shared about THEMSELVES that a friend would remember (nickname, city, job, favourite things, upcoming plans with dates). Write each in under 12 words, third person (\"Likes cutting chai\"). Skip anything already known, anything temporary, and anything sensitive: health, sexuality, religion, caste, politics, finances, passwords, contact details, or facts about other people. Return an empty list when nothing qualifies.",
    messages: [{ role: "user", content: `Already known:\n${known.join("\n") || "(nothing)"}\n\nUser message:\n${userText}` }],
  });
  if (res.stop_reason === "refusal") return [];
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];
  const parsed = memorySchema.safeParse(JSON.parse(text.text));
  return parsed.success ? parsed.data.memories : [];
}

export { Anthropic };
