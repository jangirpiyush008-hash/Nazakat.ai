import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { FREE_DAILY_MESSAGES, getCapabilities } from "@/config/features";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { extractMemories, NoProviderError, streamChat, type Turn } from "@/server/ai/llm";
import { SAFE_REPLACEMENT, unsafeReply } from "@/server/ai/output-guard";
import { llmCost } from "@/config/costs";
import { COMPANION_RULES, contextMessage } from "@/server/ai/prompt";
import { rateLimit, tooMany } from "@/server/rate-limit";
import { trackUsage } from "@/server/usage";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({
  conversationId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000).optional(),
  /** Re-answer the last user message (after an error or a stop). Not metered again. */
  retry: z.boolean().optional(),
});

const HISTORY_TURNS = 40;

/** Stream protocol: newline-delimited JSON events. */
export type ChatEvent =
  | { t: "user"; id: string }
  | { t: "delta"; text: string }
  /** The reply failed the safety check: replace what was shown with this text. */
  | { t: "replace"; text: string }
  | { t: "done"; id: string; remaining: number | null }
  | { t: "memory"; items: { id: string; fact: string; category: string }[] }
  | { t: "error"; code: ErrorCode };

export type ErrorCode = "unavailable" | "limit" | "refused" | "timeout" | "failed";

const fail = (status: number, code: ErrorCode | "unauthorized" | "invalid" | "not_found") => NextResponse.json({ error: code }, { status });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return fail(401, "unauthorized");
  const rl = rateLimit("chat", user.id);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.text && !parsed.data.retry)) return fail(400, "invalid");
  const { conversationId, text, retry } = parsed.data;

  const admin = createAdminClient();
  if (!getCapabilities().chat || !admin) return fail(503, "unavailable");

  // RLS: only returns the conversation if it belongs to this user.
  const { data: convo } = await supabase.from("conversations").select("id, companion_id").eq("id", conversationId).maybeSingle();
  if (!convo) return fail(404, "not_found");

  const [{ data: profile }, { data: persona }] = await Promise.all([
    supabase.from("profiles").select("chat_language, memory_enabled, display_name, onboarded_at").eq("id", user.id).single(),
    admin.from("companion_personas").select("system_prompt").eq("companion_id", convo.companion_id).single(),
  ]);
  if (!profile?.onboarded_at) return fail(403, "unauthorized");
  if (!persona) return fail(503, "unavailable");

  let userMessageId: string | null = null;
  let remaining: number | null = null;

  if (!retry && text) {
    const { data: used, error: meterError } = await admin.rpc("consume_daily_message", { uid: user.id, daily_limit: FREE_DAILY_MESSAGES });
    if (meterError) return fail(500, "failed");
    if (used === null) return fail(429, "limit");
    remaining = Math.max(0, FREE_DAILY_MESSAGES - used);

    const { data: saved, error } = await admin
      .from("messages")
      .insert({ conversation_id: convo.id, user_id: user.id, role: "user", content: text })
      .select("id")
      .single();
    if (error || !saved) return fail(500, "failed");
    userMessageId = saved.id;
  }

  const [{ data: rows }, { data: memories }] = await Promise.all([
    supabase.from("messages").select("role, content").eq("conversation_id", convo.id).order("created_at", { ascending: false }).limit(HISTORY_TURNS),
    profile.memory_enabled
      ? supabase.from("memory_items").select("fact").eq("companion_id", convo.companion_id).order("created_at", { ascending: false }).limit(25)
      : Promise.resolve({ data: [] as { fact: string }[] }),
  ]);

  const history = toTurns((rows ?? []).reverse());
  if (!history.length || history[history.length - 1].role !== "user") return fail(400, "invalid");
  const lastUserText = history[history.length - 1].content;
  const known = (memories ?? []).map((m) => m.fact);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      if (userMessageId) send({ t: "user", id: userMessageId });

      let reply = "";
      let provider = "unknown";
      let replaced = false;
      try {
        for await (const chunk of streamChat({
          system: COMPANION_RULES,
          persona: persona.system_prompt,
          history,
          context: contextMessage({ language: profile.chat_language, memories: known, displayName: profile.display_name }),
          language: profile.chat_language,
          signal: request.signal,
        })) {
          if (chunk.type === "delta") {
            reply += chunk.text;
            if (unsafeReply(reply)) {
              // Stop showing it and swap in a safe line.
              replaced = true;
              reply = SAFE_REPLACEMENT;
              send({ t: "replace", text: SAFE_REPLACEMENT });
              break;
            }
            send({ t: "delta", text: chunk.text });
            continue;
          }
          provider = chunk.provider;
          if (chunk.refused && !reply) {
            send({ t: "error", code: "refused" });
            return controller.close();
          }
          trackUsage({ userId: user.id, feature: "chat", provider: chunk.provider, model: chunk.model, units: chunk.inputTokens + chunk.outputTokens, unit: "tokens", costUsd: llmCost(chunk.model, chunk.inputTokens, chunk.outputTokens) });
          const { data: saved } = await admin
            .from("messages")
            .insert({
              conversation_id: convo.id,
              user_id: user.id,
              role: "assistant",
              content: reply.trim() || "…",
              provider: chunk.provider,
              model: chunk.model,
              provider_request_id: chunk.requestId,
              input_tokens: chunk.inputTokens,
              output_tokens: chunk.outputTokens,
            })
            .select("id")
            .single();
          await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convo.id);
          send({ t: "done", id: saved?.id ?? "", remaining });
        }
        if (replaced) {
          const { data: saved } = await admin
            .from("messages")
            .insert({ conversation_id: convo.id, user_id: user.id, role: "assistant", content: SAFE_REPLACEMENT, provider, moderation: "blocked" })
            .select("id")
            .single();
          await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convo.id);
          send({ t: "done", id: saved?.id ?? "", remaining });
        }
      } catch (err) {
        if (request.signal.aborted) {
          // User pressed stop: keep what they saw.
          if (reply.trim() && !replaced) {
            await admin.from("messages").insert({ conversation_id: convo.id, user_id: user.id, role: "assistant", content: reply.trim(), provider });
          }
          return controller.close();
        }
        const code: ErrorCode = err instanceof NoProviderError ? "unavailable" : (err as Error).name === "TimeoutError" ? "timeout" : "failed";
        // Log the provider error only — never message content.
        console.error("chat_provider_error", (err as Error).message.slice(0, 120));
        send({ t: "error", code });
        return controller.close();
      }

      // Memory extraction runs after the reply is visible.
      if (profile.memory_enabled && text && !replaced) {
        try {
          const found = await extractMemories(lastUserText, known, user.id, profile.chat_language);
          if (found.length) {
            const { data: inserted } = await supabase
              .from("memory_items")
              .insert(found.map((m) => ({ user_id: user.id, companion_id: convo.companion_id, fact: m.fact, category: m.category, source_message_id: userMessageId })))
              .select("id, fact, category");
            if (inserted?.length) send({ t: "memory", items: inserted });
          }
        } catch (err) {
          console.error("memory_extract_error", (err as Error).name);
        }
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

/** Collapse to alternating user/assistant turns (the API requires the first turn to be the user's). */
function toTurns(rows: { role: string; content: string }[]): Turn[] {
  const turns: Turn[] = [];
  for (const r of rows) {
    if (r.role !== "user" && r.role !== "assistant") continue;
    const last = turns[turns.length - 1];
    if (last && last.role === r.role) last.content += `\n${r.content}`;
    else turns.push({ role: r.role, content: r.content });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}
