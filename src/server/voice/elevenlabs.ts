import "server-only";

/** ElevenLabs speech-to-text (Scribe) and text-to-speech. Audio is never stored by us. */
const API = "https://api.elevenlabs.io/v1";

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY missing");
  return k;
}

export const elevenTtsModel = () => process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";

export async function elevenTranscribe(audio: Blob, filename: string) {
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
  form.append("file", audio, filename);
  const res = await fetch(`${API}/speech-to-text`, { method: "POST", headers: { "xi-api-key": key() }, body: form });
  if (!res.ok) throw new Error(`elevenlabs stt ${res.status}`);
  const j = (await res.json()) as { text?: string; language_code?: string };
  return { text: (j.text ?? "").trim(), language: j.language_code ?? null };
}

/** Defaults are ElevenLabs premade voices; set a companion's voice_id or the env vars for Indian voices. */
export function elevenVoice(gender: string, voiceId: string | null) {
  if (voiceId) return voiceId;
  return gender === "men" ? process.env.ELEVENLABS_VOICE_MALE || "pNInz6obpgDQGcFmaJgB" : process.env.ELEVENLABS_VOICE_FEMALE || "21m00Tcm4TlvDq8ikWAM";
}

export async function elevenSpeak(text: string, voiceId: string) {
  const res = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: text.slice(0, 2500), model_id: elevenTtsModel() }),
  });
  if (!res.ok) throw new Error(`elevenlabs tts ${res.status}`);
  return { audio: Buffer.from(await res.arrayBuffer()), contentType: "audio/mpeg" };
}
