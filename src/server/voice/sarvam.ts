import "server-only";

/** Sarvam AI: Bulbul text-to-speech and Saaras speech-to-text (Indian languages). */
const API = "https://api.sarvam.ai";

function key() {
  const k = process.env.SARVAM_API_KEY;
  if (!k) throw new Error("SARVAM_API_KEY missing");
  return k;
}

export const sarvamTtsModel = () => process.env.SARVAM_TTS_MODEL || "bulbul:v3";
export const sarvamSttModel = () => process.env.SARVAM_STT_MODEL || "saaras:v4";

export function sarvamSpeaker(gender: string) {
  return gender === "men" ? process.env.SARVAM_SPEAKER_MALE || "shubh" : process.env.SARVAM_SPEAKER_FEMALE || "ritu";
}

export async function sarvamSpeak(text: string, opts: { speaker: string; language: string }) {
  const res = await fetch(`${API}/text-to-speech`, {
    method: "POST",
    headers: { "api-subscription-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.slice(0, 2500),
      language_code: opts.language,
      speaker: opts.speaker,
      model: sarvamTtsModel(),
      output_audio_codec: "mp3",
      speech_sample_rate: 24000,
      enable_preprocessing: true,
    }),
  });
  if (!res.ok) throw new Error(`sarvam tts ${res.status}`);
  const j = (await res.json()) as { audios?: string[] };
  if (!j.audios?.length) throw new Error("sarvam tts empty");
  return { audio: Buffer.concat(j.audios.map((a) => Buffer.from(a, "base64"))), contentType: "audio/mpeg" };
}

export async function sarvamTranscribe(audio: Blob, filename: string) {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", sarvamSttModel());
  form.append("language_code", "unknown");
  const res = await fetch(`${API}/speech-to-text`, { method: "POST", headers: { "api-subscription-key": key() }, body: form });
  if (!res.ok) throw new Error(`sarvam stt ${res.status}`);
  const j = (await res.json()) as { transcript?: string; language_code?: string | null };
  return { text: (j.transcript ?? "").trim(), language: j.language_code ?? null };
}
