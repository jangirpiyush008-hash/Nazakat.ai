import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { replyOnce, type Turn } from "@/server/ai/anthropic";
import { COMPANION_RULES, contextMessage } from "@/server/ai/prompt";
import { billCallMinutes } from "@/server/calls";
import { rateLimit, tooMany } from "@/server/rate-limit";
import { speak, transcribe } from "@/server/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

const history = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(600) })).max(12);
const MAX_AUDIO_BYTES = 2_000_000;

/**
 * One spoken turn: bill elapsed minutes → speech-to-text → companion reply →
 * text-to-speech. Audio and transcripts are not stored.
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
  const prior = history.safeParse(JSON.parse(String(form?.get("history") ?? "[]")));
  if (typeof callId !== "string" || !(audio instanceof Blob) || audio.size > MAX_AUDIO_BYTES || !prior.success) {
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
    const filename = audio.type.includes("ogg") ? "turn.ogg" : audio.type.includes("mp4") ? "turn.m4a" : "turn.webm";
    const heard = await transcribe(audio, filename, auth.user.id);
    if (!heard.text) return NextResponse.json({ empty: true, minutes: bill.minutes });

    const turns: Turn[] = [...prior.data, { role: "user", content: heard.text }];
    while (turns.length && turns[0].role !== "user") turns.shift();
    const context =
      contextMessage({ language: profile.chat_language, memories: profile.memory_enabled ? (memories ?? []).map((m) => m.fact) : [], displayName: profile.display_name }) +
      "\nThis is a live voice call. Reply in 1–2 short, natural spoken sentences. No emojis, lists or stage directions.";
    const reply = await replyOnce({ system: COMPANION_RULES, persona: persona.system_prompt, history: turns, context, userId: auth.user.id });
    if (!reply) return NextResponse.json({ error: "refused", heard: heard.text, minutes: bill.minutes }, { status: 422 });

    const voice = await speak(reply, { gender: companion.gender, voiceId: companion.voice_id, chatLanguage: profile.chat_language, userId: auth.user.id, feature: "call_tts" });
    return NextResponse.json({ heard: heard.text, reply, audio: voice.audio.toString("base64"), contentType: voice.contentType, minutes: bill.minutes });
  } catch (err) {
    console.error("call_turn_error", (err as Error).message);
    return NextResponse.json({ error: "failed", minutes: bill.minutes }, { status: 502 });
  }
}
