import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient() {
  const apiKey = process.env.AI_CHAT_API_KEY;
  if (!apiKey) return null;
  client ??= new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 });
  return client;
}

export const chatModel = () => process.env.AI_CHAT_MODEL || "claude-opus-5-5";

import type { Turn } from "./llm";

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

export { Anthropic };
