import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { streamChat, type Turn } from "@/server/ai/llm";
import { llmCost } from "@/config/costs";
import { trackUsage } from "@/server/usage";
import { SAFE_REPLACEMENT, unsafeReply } from "@/server/ai/output-guard";
import { COMPANION_RULES, contextMessage } from "@/server/ai/prompt";
import { billCallMinutes } from "@/server/calls";
import { rateLimit, tooMany } from "@/server/rate-limit";
import { speak, transcribe } from "@/server/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

const history = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(600) })).max(12);
const MAX_AUDIO_BYTES = 2_000_000;
/** A finished sentence (or a long clause) ready to be spoken. */
const SENTENCE = /^([\s\S]+?[.!?।…]+|[\s\S]{90,}?[,;:])(\s+)/;

export type CallEvent =
  | { t: "heard"; text: string; minutes: number }
  | { t: "audio"; text: string; audio: string; contentType: string }
  | { t: "done" }
  | { t: "error"; code: "failed" | "partial" };

/**
 * One spoken turn: bill elapsed minutes → speech-to-text → companion reply →
 * text-to-speech. Audio and transcripts are not stored.
 * With greet=1 (no audio) the companion answers the call and speaks first.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const rl = rateLimit("callTurn", auth.user.id);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const form = await request.formData().catch(() => null);
  const callId = form?.get("callId");
  const audio = form?.get("audio");
  const greet = form?.get("greet") === "1";
  const prior = history.safeParse(JSON.parse(String(form?.get("history") ?? "[]")));
  if (typeof callId !== "string" || (!greet && !(audio instanceof Blob)) || (audio instanceof Blob && audio.size > MAX_AUDIO_BYTES) || !prior.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { data: call } = await supabase.from("call_sessions").select("*").eq("id", callId).maybeSingle();
  if (!call || call.status !== "active") return NextResponse.json({ error: "ended" }, { status: 409 });
  const bill = await billCallMinutes(admin, call);
  if (!bill.ok) {
    await admin.from("call_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", call.id);
    return NextResponse.json({ error: "insufficient_sparks", minutes: bill.minutes }, { status: 402 });
  }

  const [{ data: companion }, { data: persona }, { data: profile }, { data: memories }] = await Promise.all([
    admin.from("companions").select("name, gender, voice_id").eq("id", call.companion_id).single(),
    admin.from("companion_personas").select("system_prompt").eq("companion_id", call.companion_id).single(),
    supabase.from("profiles").select("chat_language, display_name, memory_enabled").eq("id", auth.user.id).single(),
    supabase.from("memory_items").select("fact").eq("companion_id", call.companion_id).limit(15),
  ]);
  if (!companion || !persona || !profile) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  try {
    let heard = { text: "" };
    if (audio instanceof Blob) {
      const filename = audio.type.includes("ogg") ? "turn.ogg" : audio.type.includes("mp4") ? "turn.m4a" : "turn.webm";
      heard = await transcribe(audio, filename, auth.user.id);
      if (!heard.text) return NextResponse.json({ empty: true, minutes: bill.minutes });
    }

    const opener = `(The call just connected. You picked up. Greet ${profile.display_name || "them"} warmly and playfully in one short sentence, in character.)`;
    const turns: Turn[] = greet ? [{ role: "user", content: opener }] : [...prior.data, { role: "user", content: heard.text }];
    while (turns.length && turns[0].role !== "user") turns.shift();
    const context =
      contextMessage({ language: profile.chat_language, memories: profile.memory_enabled ? (memories ?? []).map((m) => m.fact) : [], displayName: profile.display_name }) +
      "\nThis is a live voice call. Talk like a real person on the phone: 1–2 short, natural spoken sentences, quick back-and-forth, react to what they just said. No emojis, lists, asterisks or stage directions.";
    const voiceOpts = { gender: companion.gender, voiceId: companion.voice_id, chatLanguage: profile.chat_language, userId: auth.user.id, feature: "call_tts" as const };
    const userId = auth.user.id;

    // Stream: transcript first, then each sentence's audio as soon as it is spoken,
    // so the character starts talking before the whole reply is written.
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (e: CallEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        send({ t: "heard", text: heard.text, minutes: bill.minutes });
        let chain = Promise.resolve();
        const speakNext = (sentence: string) => {
          const clean = sentence.replace(/[*_#~`]|\p{Extended_Pictographic}/gu, "").trim();
          if (!clean) return;
          const audio = speak(clean, voiceOpts).catch(() => null); // synthesise in parallel…
          chain = chain.then(async () => {
            const v = await audio; // …but send in order
            if (v) send({ t: "audio", text: clean, audio: v.audio.toString("base64"), contentType: v.contentType });
          });
        };
        let reply = "";
        let pending = "";
        try {
          for await (const chunk of streamChat({ system: COMPANION_RULES, persona: persona.system_prompt, history: turns, context, language: profile.chat_language, signal: request.signal })) {
            if (chunk.type !== "delta") {
              trackUsage({ userId, feature: "call_llm", provider: chunk.provider, model: chunk.model, units: chunk.inputTokens + chunk.outputTokens, unit: "tokens", costUsd: llmCost(chunk.model, chunk.inputTokens, chunk.outputTokens) });
              continue;
            }
            reply += chunk.text;
            if (unsafeReply(reply)) {
              pending = "";
              speakNext(SAFE_REPLACEMENT);
              break;
            }
            pending += chunk.text;
            for (let m = pending.match(SENTENCE); m; m = pending.match(SENTENCE)) {
              speakNext(m[1]);
              pending = pending.slice(m[0].length);
            }
          }
          if (pending.trim()) speakNext(pending);
          await chain;
          send({ t: "done" });
        } catch (err) {
          console.error("call_turn_error", (err as Error).message);
          await chain;
          send({ t: "error", code: reply ? "partial" : "failed" });
        }
        controller.close();
      },
    });
    return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("call_turn_error", (err as Error).message);
    return NextResponse.json({ error: "failed", minutes: bill.minutes }, { status: 502 });
  }
}
