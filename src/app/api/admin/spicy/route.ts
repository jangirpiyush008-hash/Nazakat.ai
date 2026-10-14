import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { completeText } from "@/server/ai/llm";
import { checkImage } from "@/server/media/image-check";
import { speak, transcribe } from "@/server/voice";
import { spicyCreate, spicyModels, spicyStatus } from "@/server/media/spicy";

export const runtime = "nodejs";

/**
 * Operator-only proxy for catalogue work (scripts/gen-portraits.ts): lets the
 * script run SpicyAPI tasks with the server's key, so the key never leaves the
 * server. Authorised by the Supabase service-role key; only our own models.
 */
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), model: z.string(), input: z.record(z.string(), z.unknown()), idempotencyKey: z.string().uuid() }),
  z.object({ action: z.literal("status"), taskId: z.string().min(4).max(120) }),
  z.object({ action: z.literal("check"), url: z.string().url() }),
  /** Live check of the call pipeline: reply (per language) → speech → back to text. */
  z.object({ action: z.literal("selftest") }),
]);

function authorised(request: NextRequest) {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const got = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    if (parsed.data.action === "status") return NextResponse.json(await spicyStatus(parsed.data.taskId));
    if (parsed.data.action === "check") return NextResponse.json(await checkImage(parsed.data.url, null));
    if (parsed.data.action === "selftest") return NextResponse.json(await selftest());
    const allowed = [spicyModels.textToImage(), spicyModels.faceEdit(), spicyModels.imageToVideo()];
    if (!allowed.includes(parsed.data.model)) return NextResponse.json({ error: "model_not_allowed" }, { status: 400 });
    return NextResponse.json(await spicyCreate(parsed.data.model, parsed.data.input, parsed.data.idempotencyKey));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message.slice(0, 200) }, { status: 502 });
  }
}

async function selftest() {
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      out[name] = { ok: true, ms: Date.now() - t, result: await fn() };
      (out[name] as { ms: number }).ms = Date.now() - t;
    } catch (err) {
      out[name] = { ok: false, ms: Date.now() - t, error: (err as Error).message.slice(0, 160) };
    }
  };
  const ask = (language: string) => () =>
    completeText({ system: "You are Tara, a playful 25-year-old surf instructor from Goa. Reply in one short sentence.", history: [{ role: "user", content: "(The call just connected. Greet them warmly.)" }], language, userId: null, feature: "call_llm", maxTokens: 800 });
  await step("reply_english", ask("english"));
  await step("reply_hinglish", ask("hinglish"));
  let audio: Buffer | null = null;
  await step("speech_hindi", async () => {
    const v = await speak("Hello! Kaise ho? Aaj ka din kaisa tha?", { gender: "women", voiceId: null, chatLanguage: "hinglish", userId: null, feature: "call_tts" });
    audio = v.audio;
    return { provider: v.provider, bytes: v.audio.length };
  });
  await step("speech_english", async () => {
    const v = await speak("Hey you, how was your day?", { gender: "men", voiceId: null, chatLanguage: "english", userId: null, feature: "call_tts" });
    return { provider: v.provider, bytes: v.audio.length };
  });
  await step("listen", async () => {
    if (!audio) throw new Error("no audio to transcribe");
    const heard = await transcribe(new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "turn.mp3", null);
    return heard.text;
  });
  return out;
}
