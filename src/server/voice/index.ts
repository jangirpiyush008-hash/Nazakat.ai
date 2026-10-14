import "server-only";
import { unitCosts } from "@/config/costs";
import { trackUsage } from "@/server/usage";
import { elevenSpeak, elevenTranscribe, elevenTtsModel, elevenVoice } from "./elevenlabs";
import { sarvamSpeak, sarvamSpeaker, sarvamSttModel, sarvamTranscribe, sarvamTtsModel } from "./sarvam";

/**
 * Voice provider chain. Order comes from VOICE_PROVIDERS (default
 * "sarvam,elevenlabs"); providers without a key are skipped, and a failure
 * falls through to the next one.
 */
type Provider = "sarvam" | "elevenlabs";

export function voiceProviders(): Provider[] {
  const order = (process.env.VOICE_PROVIDERS || "sarvam,elevenlabs").split(",").map((s) => s.trim()) as Provider[];
  return order.filter((p) => (p === "sarvam" ? Boolean(process.env.SARVAM_API_KEY) : p === "elevenlabs" ? Boolean(process.env.ELEVENLABS_API_KEY) : false));
}

export const hasVoiceProvider = () => voiceProviders().length > 0;

export async function speak(
  text: string,
  opts: { gender: string; voiceId: string | null; chatLanguage: string; userId: string; feature: "voice_note" | "call_tts" },
) {
  let lastError: unknown;
  for (const p of voiceProviders()) {
    try {
      const out =
        p === "sarvam"
          ? await sarvamSpeak(text, { speaker: sarvamSpeaker(opts.gender), language: opts.chatLanguage === "english" ? "en-IN" : "hi-IN" })
          : await elevenSpeak(text, elevenVoice(opts.gender, opts.voiceId));
      trackUsage({ userId: opts.userId, feature: opts.feature, provider: p, model: p === "sarvam" ? sarvamTtsModel() : elevenTtsModel(), units: text.length, unit: "chars", costUsd: text.length * (unitCosts.ttsPerChar[p] ?? 0) });
      return { ...out, provider: p };
    } catch (err) {
      lastError = err;
      console.error("tts_provider_failed", p, (err as Error).message);
    }
  }
  throw lastError ?? new Error("no voice provider configured");
}

export async function transcribe(audio: Blob, filename: string, userId: string) {
  const minutes = Math.max(0.1, audio.size / (16_000 * 60)); // rough: ~16 KB/s compressed speech
  let lastError: unknown;
  for (const p of voiceProviders()) {
    try {
      const out = p === "sarvam" ? await sarvamTranscribe(audio, filename) : await elevenTranscribe(audio, filename);
      trackUsage({ userId, feature: "call_stt", provider: p, model: p === "sarvam" ? sarvamSttModel() : "scribe", units: minutes, unit: "minutes", costUsd: minutes * (unitCosts.sttPerMinute[p] ?? 0) });
      return { ...out, provider: p };
    } catch (err) {
      lastError = err;
      console.error("stt_provider_failed", p, (err as Error).message);
    }
  }
  throw lastError ?? new Error("no voice provider configured");
}
