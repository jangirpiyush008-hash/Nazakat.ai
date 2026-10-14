import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { FREE_DAILY_MESSAGES, getCapabilities } from "@/config/features";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Anthropic, chatModel, extractMemories, streamReply, type Turn } from "@/server/ai/anthropic";
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

      const llm = streamReply({
        system: COMPANION_RULES,
        persona: persona.system_prompt,
        history,
        context: contextMessage({ language: profile.chat_language, memories: known, displayName: profile.display_name }),
        signal: request.signal,
      });
      if (!llm) {
        send({ t: "error", code: "unavailable" });
        return controller.close();
      }

      let reply = "";
      try {
        for await (const event of llm) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            reply += event.delta.text;
            send({ t: "delta", text: event.delta.text });
          }
        }
        const final = await llm.finalMessage();
        if (final.stop_reason === "refusal" && !reply) {
          send({ t: "error", code: "refused" });
          return controller.close();
        }
        const { data: saved } = await admin
          .from("messages")
          .insert({
            conversation_id: convo.id,
            user_id: user.id,
            role: "assistant",
            content: reply.trim() || "…",
            provider: "anthropic",
            model: final.model,
            provider_request_id: final.id,
            input_tokens: final.usage.input_tokens,
            output_tokens: final.usage.output_tokens,
          })
          .select("id")
          .single();
        await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convo.id);
        trackUsage({ userId: user.id, feature: "chat", provider: "anthropic", model: final.model, units: final.usage.input_tokens + final.usage.output_tokens, unit: "tokens", costUsd: llmCost(final.model, final.usage.input_tokens, final.usage.output_tokens) });
        send({ t: "done", id: saved?.id ?? "", remaining });
      } catch (err) {
        if (request.signal.aborted) {
          // User pressed stop: keep what they saw.
          if (reply.trim()) {
            await admin.from("messages").insert({ conversation_id: convo.id, user_id: user.id, role: "assistant", content: reply.trim(), provider: "anthropic", model: chatModel() });
          }
          return controller.close();
        }
        const code: ErrorCode = err instanceof Anthropic.APIConnectionTimeoutError ? "timeout" : "failed";
        // Log the provider error class only — never message content.
        console.error("chat_provider_error", err instanceof Anthropic.APIError ? err.status : (err as Error).name);
        send({ t: "error", code });
        return controller.close();
      }

      // Memory extraction runs after the reply is visible.
      if (profile.memory_enabled && text) {
        try {
          const found = await extractMemories(lastUserText, known, user.id);
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
