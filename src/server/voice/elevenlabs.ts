import "server-only";

/** ElevenLabs speech-to-text (Scribe) and text-to-speech. Audio is never stored. */
const API = "https://api.elevenlabs.io/v1";

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY missing");
  return k;
}

export async function transcribe(audio: Blob) {
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
  form.append("file", audio, "turn.webm");
  const res = await fetch(`${API}/speech-to-text`, { method: "POST", headers: { "xi-api-key": key() }, body: form });
  if (!res.ok) throw new Error(`stt ${res.status}`);
  const j = (await res.json()) as { text?: string; language_code?: string };
  return { text: (j.text ?? "").trim(), language: j.language_code ?? null };
}

/** Default voices are ElevenLabs premade voices; set a companion's voice_id or the env vars to use Indian voices from the Voice Library. */
export function voiceFor(gender: string, voiceId: string | null) {
  if (voiceId) return voiceId;
  return gender === "men"
    ? process.env.ELEVENLABS_VOICE_MALE || "pNInz6obpgDQGcFmaJgB"
    : process.env.ELEVENLABS_VOICE_FEMALE || "21m00Tcm4TlvDq8ikWAM";
}

export async function speak(text: string, voiceId: string) {
  const res = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2" }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  return res.arrayBuffer();
}
