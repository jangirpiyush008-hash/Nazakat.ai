import "server-only";
import { z } from "zod";
import { llmCost } from "@/config/costs";
import { trackUsage, type UsageEvent } from "@/server/usage";
import { streamReply as anthropicStream, Anthropic } from "./anthropic";

/**
 * Chat provider layer. Each chat language has an ordered provider list
 * (env-configurable); providers without a key are skipped and a provider
 * that fails before sending anything falls through to the next.
 *
 *   English  → DeepSeek, then Claude, then Sarvam
 *   Hindi / Hinglish → Sarvam, then Claude, then DeepSeek
 */
export type Provider = "anthropic" | "deepseek" | "sarvam";
export type Turn = { role: "user" | "assistant"; content: string };

const keyOf: Record<Provider, () => string | undefined> = {
  anthropic: () => process.env.AI_CHAT_API_KEY,
  deepseek: () => process.env.DEEPSEEK_API_KEY,
  sarvam: () => process.env.SARVAM_API_KEY,
};

export const modelOf: Record<Provider, () => string> = {
  anthropic: () => process.env.AI_CHAT_MODEL || "claude-opus-5-5",
  deepseek: () => process.env.DEEPSEEK_MODEL || "deepseek-flash",
  sarvam: () => process.env.SARVAM_CHAT_MODEL || "sarvam-105b-conversations",
};

const defaults = { english: "deepseek,anthropic,sarvam", hindi: "sarvam,anthropic,deepseek" };

export function chatProviders(language: string): Provider[] {
  const route = language === "english" ? process.env.CHAT_PROVIDERS_ENGLISH || defaults.english : process.env.CHAT_PROVIDERS_HINDI || defaults.hindi;
  return route
    .split(",")
    .map((s) => s.trim() as Provider)
    .filter((p) => p in keyOf && Boolean(keyOf[p]()));
}

export const anyChatProvider = () => (Object.keys(keyOf) as Provider[]).some((p) => Boolean(keyOf[p]()));

export type StreamChunk =
  | { type: "delta"; text: string }
  | { type: "done"; provider: Provider; model: string; inputTokens: number; outputTokens: number; requestId: string | null; refused: boolean };

type ChatOpts = { system: string; persona: string; history: Turn[]; context: string; language: string; signal?: AbortSignal };

/** Streams a reply, trying providers in order until one starts answering. */
export async function* streamChat(opts: ChatOpts): AsyncGenerator<StreamChunk> {
  const providers = chatProviders(opts.language);
  if (!providers.length) throw new NoProviderError();
  let lastError: unknown;
  for (const p of providers) {
    let started = false;
    try {
      const gen = p === "anthropic" ? streamAnthropic(opts) : streamOpenAICompatible(p, opts);
      for await (const chunk of gen) {
        if (chunk.type === "delta") started = true;
        yield chunk;
      }
      return;
    } catch (err) {
      if (started || opts.signal?.aborted) throw err; // can't retry mid-reply
      lastError = err;
      console.error("chat_provider_failed", p, (err as Error).message);
    }
  }
  throw lastError ?? new NoProviderError();
}

export class NoProviderError extends Error {
  constructor() {
    super("no chat provider configured");
  }
}

async function* streamAnthropic(opts: ChatOpts): AsyncGenerator<StreamChunk> {
  const stream = anthropicStream(opts);
  if (!stream) throw new NoProviderError();
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield { type: "delta", text: event.delta.text };
  }
  const final = await stream.finalMessage();
  yield { type: "done", provider: "anthropic", model: final.model, inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens, requestId: final.id, refused: final.stop_reason === "refusal" };
}

function endpoint(p: Exclude<Provider, "anthropic">) {
  return p === "deepseek" ? `${process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/chat/completions` : "https://api.sarvam.ai/v1/chat/completions";
}

function headers(p: Exclude<Provider, "anthropic">) {
  const key = keyOf[p]()!;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    ...(p === "sarvam" ? { "api-subscription-key": key } : {}),
  };
}

function extraParams(p: Exclude<Provider, "anthropic">) {
  // Sarvam reasons by default; turn it off for chat latency.
  return p === "sarvam" ? { reasoning_effort: null } : {};
}

function oaMessages(system: string, history: Turn[]) {
  return [{ role: "system", content: system }, ...history.map((t) => ({ role: t.role, content: t.content }))];
}

async function* streamOpenAICompatible(p: Exclude<Provider, "anthropic">, opts: ChatOpts): AsyncGenerator<StreamChunk> {
  const model = modelOf[p]();
  const res = await fetch(endpoint(p), {
    method: "POST",
    headers: headers(p),
    signal: opts.signal,
    body: JSON.stringify({
      model,
      messages: oaMessages(`${opts.system}\n\n${opts.persona}\n\n${opts.context}`, opts.history),
      stream: true,
      max_tokens: 1024,
      temperature: 0.8,
      ...extraParams(p),
    }),
  });
  if (!res.ok || !res.body) throw new Error(`${p} ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  type Usage = { prompt_tokens?: number; completion_tokens?: number };
  let usage: Usage | null = null;
  let requestId: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data) as { id?: string; choices?: { delta?: { content?: string | null } }[]; usage?: Usage };
        requestId ??= j.id ?? null;
        if (j.usage) usage = j.usage;
        const text = j.choices?.[0]?.delta?.content;
        if (text) {
          out += text;
          yield { type: "delta", text };
        }
      } catch {
        /* keep-alive or partial line */
      }
    }
  }
  const approx = (s: string) => Math.ceil(s.length / 4);
  yield {
    type: "done",
    provider: p,
    model,
    inputTokens: usage?.prompt_tokens ?? approx(JSON.stringify(opts.history) + opts.system + opts.persona),
    outputTokens: usage?.completion_tokens ?? approx(out),
    requestId,
    refused: false,
  };
}

/** One-shot completion (voice calls, memory extraction, safety checks), with provider fallback. */
export async function completeText(opts: {
  system: string;
  history: Turn[];
  language: string;
  userId: string | null;
  feature: UsageEvent["feature"];
  maxTokens?: number;
}): Promise<string | null> {
  let lastError: unknown;
  for (const p of chatProviders(opts.language)) {
    try {
      let text: string;
      let model: string;
      let inTok: number;
      let outTok: number;
      if (p === "anthropic") {
        const client = new Anthropic({ apiKey: keyOf.anthropic()!, timeout: 30_000, maxRetries: 1 });
        const res = await client.messages.create({
          model: modelOf.anthropic(),
          max_tokens: opts.maxTokens ?? 1024,
          output_config: { effort: "low" },
          system: opts.system,
          messages: opts.history.map((t) => ({ role: t.role, content: t.content })),
        });
        if (res.stop_reason === "refusal") return null;
        text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ");
        model = res.model;
        inTok = res.usage.input_tokens;
        outTok = res.usage.output_tokens;
      } else {
        model = modelOf[p]();
        const res = await fetch(endpoint(p), {
          method: "POST",
          headers: headers(p),
          signal: AbortSignal.timeout(30_000),
          body: JSON.stringify({ model, messages: oaMessages(opts.system, opts.history), max_tokens: opts.maxTokens ?? 1024, temperature: 0.7, ...extraParams(p) }),
        });
        if (!res.ok) throw new Error(`${p} ${res.status}`);
        const j = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        text = j.choices?.[0]?.message?.content ?? "";
        inTok = j.usage?.prompt_tokens ?? 0;
        outTok = j.usage?.completion_tokens ?? 0;
      }
      trackUsage({ userId: opts.userId, feature: opts.feature, provider: p, model, units: inTok + outTok, unit: "tokens", costUsd: llmCost(model, inTok, outTok) });
      return text.trim();
    } catch (err) {
      lastError = err;
      console.error("complete_provider_failed", p, (err as Error).message);
    }
  }
  if (lastError) throw lastError;
  return null;
}

/** Pulls the first JSON object out of a model reply (models sometimes wrap it in prose or code fences). */
export function parseJsonLoose<T>(text: string | null, schema: z.ZodType<T>): T | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const memorySchema = z.object({
  memories: z.array(z.object({ fact: z.string().min(2).max(200), category: z.enum(["preference", "place", "name", "date", "other"]) })).max(3),
});

/**
 * Pulls 0–3 durable, non-sensitive facts out of the latest user message.
 * Skips health, sexuality, religion, caste, politics, finances and anything
 * about third parties (DPDP data minimisation).
 */
export async function extractMemories(userText: string, known: string[], userId: string | null, language: string) {
  if (userText.trim().length < 12) return [];
  const reply = await completeText({
    language,
    userId,
    feature: "memory",
    maxTokens: 400,
    system:
      'Extract at most 3 short, durable facts the user shared about THEMSELVES that a friend would remember (nickname, city, job, favourite things, upcoming plans with dates). Write each in English, under 12 words, third person ("Likes cutting chai"). Skip anything already known, temporary, or sensitive: health, sexuality, religion, caste, politics, finances, passwords, contact details, or facts about other people. Reply with ONLY JSON: {"memories":[{"fact":"...","category":"preference|place|name|date|other"}]} — use an empty list when nothing qualifies.',
    history: [{ role: "user", content: `Already known:\n${known.join("\n") || "(nothing)"}\n\nUser message:\n${userText}` }],
  });
  return parseJsonLoose(reply, memorySchema)?.memories ?? [];
}

export { llmCost };
