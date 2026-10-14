// Checks every configured provider key with the cheapest possible call.
// Run:  node --env-file=.env.local scripts/check-keys.ts          (free checks only)
//       node --env-file=.env.local scripts/check-keys.ts --spend  (also 1 tiny paid call each: ~$0.01 total)
const spend = process.argv.includes("--spend");
const env = process.env;
type Row = [name: string, status: "OK" | "FAIL" | "SKIP", detail: string];
const rows: Row[] = [];
const add = (name: string, ok: boolean | null, detail = "") => rows.push([name, ok === null ? "SKIP" : ok ? "OK" : "FAIL", detail]);

async function run(name: string, needs: string[], fn: () => Promise<string>) {
  const missing = needs.filter((k) => !env[k]);
  if (missing.length) return add(name, null, `missing ${missing.join(", ")}`);
  try {
    add(name, true, await fn());
  } catch (e) {
    add(name, false, (e as Error).message.slice(0, 160));
  }
}
const must = async (res: Response) => {
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  return res;
};

await run("Supabase (service key)", ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], async () => {
  const r = await must(await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/companions?select=slug`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }));
  return `${(await r.json()).length} companions`;
});
await run("Anthropic (chat)", ["AI_CHAT_API_KEY"], async () => {
  const r = await must(await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": env.AI_CHAT_API_KEY!, "anthropic-version": "2023-06-01" } }));
  const ids = ((await r.json()).data as { id: string }[]).map((m) => m.id);
  const model = env.AI_CHAT_MODEL || "claude-opus-5-5";
  if (!ids.includes(model)) throw new Error(`key works but model ${model} not available`);
  return `model ${model} available`;
});
await run("DeepSeek (English chat)", ["DEEPSEEK_API_KEY"], async () => {
  const r = await must(await fetch(`${env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/models`, { headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` } }));
  const ids = ((await r.json()).data as { id: string }[]).map((m) => m.id);
  return `models: ${ids.slice(0, 5).join(", ")}`;
});
await run("Sarvam (Hindi chat)", ["SARVAM_API_KEY"], async () => {
  if (!spend) return "key present (use --spend to test a one-line Hindi reply)";
  const r = await must(await fetch("https://api.sarvam.ai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${env.SARVAM_API_KEY}`, "api-subscription-key": env.SARVAM_API_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ model: env.SARVAM_CHAT_MODEL || "sarvam-105b-conversations", messages: [{ role: "user", content: "Ek line mein hello bolo" }], max_tokens: 40, reasoning_effort: null }) }));
  return `reply: ${String((await r.json()).choices?.[0]?.message?.content ?? "").slice(0, 60)}`;
});
await run("ElevenLabs", ["ELEVENLABS_API_KEY"], async () => {
  const r = await must(await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY! } }));
  const j = await r.json();
  return `tier ${j.tier}, ${j.character_count}/${j.character_limit} chars used`;
});
await run("Sarvam (tts)", ["SARVAM_API_KEY"], async () => {
  if (!spend) return "key present (use --spend to test a 2-word TTS)";
  const r = await must(await fetch("https://api.sarvam.ai/text-to-speech", { method: "POST", headers: { "api-subscription-key": env.SARVAM_API_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ text: "Namaste ji", language_code: "hi-IN", model: env.SARVAM_TTS_MODEL || "bulbul:v3", speaker: env.SARVAM_SPEAKER_FEMALE || "ritu" }) }));
  return `${(await r.json()).audios?.length ?? 0} audio clip(s)`;
});
await run("fal.ai (photos/videos)", ["FAL_KEY"], async () => {
  if (!spend) return "key present (use --spend to test one FLUX Schnell image)";
  const r = await must(await fetch("https://fal.run/fal-ai/flux/schnell", { method: "POST", headers: { Authorization: `Key ${env.FAL_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "a cup of masala chai on a rainy window sill", image_size: "square", enable_safety_checker: true }) }));
  const j = await r.json();
  return `image ${j.images?.[0]?.url ? "generated" : "missing"}`;
});

const flags = ["FEATURE_IMAGE_GEN", "FEATURE_VIDEO_GEN", "FEATURE_VOICE_CALLS", "FEATURE_VOICE_NOTES"].map((f) => `${f}=${env[f] === "true" ? "on" : "off"}`).join("  ");
for (const [n, s, d] of rows) console.log(`${s.padEnd(4)}  ${n.padEnd(24)} ${d}`);
console.log(`\nFeature switches: ${flags}`);
if (rows.some((r) => r[1] === "FAIL")) process.exit(1);
