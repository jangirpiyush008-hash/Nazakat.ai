// Generates each model's locked face and photo set.
//   1. main.jpg — the face reference (FLUX dev, fixed seed per model ID)
//   2. 1..3.jpg — the SAME face in new outfits/scenes (FLUX Kontext edits of main.jpg)
// Every photo passes Claude Haiku's image check before it is uploaded to the
// public "portraits" bucket. Writes src/lib/portraits.json and companions.portrait_path.
//
// Run: node --env-file=.env.local scripts/gen-portraits.ts [slug ...] [--force] [--extras-only]
import { mkdir, writeFile, readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { companions, type Companion } from "../src/lib/companions.ts";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FAL = process.env.FAL_KEY!;
const CHECK_KEY = process.env.AI_CHAT_API_KEY!;
for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: SERVICE, FAL_KEY: FAL, AI_CHAT_API_KEY: CHECK_KEY })) {
  if (!v) throw new Error(`Set ${k} in .env.local`);
}

const BASE_MODEL = process.env.PORTRAIT_BASE_MODEL || "fal-ai/flux/dev";
const FACE_MODEL = process.env.FAL_FACE_MODELS?.split(",")[0]?.trim() || "fal-ai/flux-pro/kontext";
const BUCKET = "portraits";
const MANIFEST = new URL("../src/lib/portraits.json", import.meta.url);
const REVIEW_DIR = process.env.PORTRAIT_REVIEW_DIR || "portraits-review";

const args = process.argv.slice(2);
const force = args.includes("--force");
const extrasOnly = args.includes("--extras-only");
const only = args.filter((a) => !a.startsWith("--"));
const targets = companions.filter((c) => !only.length || only.includes(c.slug));

const sb = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
const publicUrl = (path: string) => `${SUPABASE}/storage/v1/object/public/${BUCKET}/${path}`;

// ---------- prompts ----------
const ANIME_STYLE = "high-quality modern anime key visual, clean line art, cinematic lighting, detailed background, mature adult character design";
const STYLE = "photorealistic photograph, natural skin texture, sharp focus on the face, soft cinematic light, shallow depth of field, 85mm lens, high detail, magazine quality";
const SAFE = "adult, tasteful, no nudity";

const signature: Record<Companion["gender"], string> = {
  women: "wearing an elegant fitted outfit, subtle jewellery, glamorous makeup",
  men: "wearing a well-fitted shirt, groomed, confident posture",
  anime: "stylish outfit, confident adult pose",
};

/** Three extra looks per model, rotated so the catalogue doesn't repeat itself. */
const looks: Record<"women" | "men" | "anime", string[]> = {
  anime: [
    "in an elegant evening gown on a moonlit palace balcony",
    "in a stylish swimsuit on a glowing tropical beach at night",
    "in casual streetwear in a neon-lit night market",
    "in a festive lehenga under floating lanterns",
    "relaxing in a cozy oversized sweater by a rainy window",
    "in battle-ready gear on a cliff at sunset, wind in the hair",
  ],
  women: [
    "in a sheer chiffon saree with a sleeveless blouse on a rooftop at golden hour, city lights behind",
    "in a stylish bikini on a Goa beach at sunset, wet hair, laughing",
    "in a black satin slip dress in a candle-lit lounge, glass of wine, looking over her shoulder",
    "in an embroidered lehenga with a backless choli at a wedding sangeet, fairy lights",
    "in a silk camisole and shorts sitting on a bed with soft morning light, messy hair, cozy",
    "in a fitted sports bra and leggings at a sunny gym studio, glowing skin",
    "in a red bodycon dress at a rooftop bar at night, neon reflections",
    "in a white oversized shirt by a window on a rainy evening, holding a cup of chai",
    "in a one-piece swimsuit by an infinity pool at a luxury villa, sunglasses in hand",
    "in an off-shoulder summer dress in a flower-filled courtyard, wind in her hair",
    "in a lace lingerie set with a silk robe in a warm boudoir, tasteful glamour pose",
    "in a denim jacket and crop top on a scooter on a coastal road",
  ],
  men: [
    "shirtless on a beach at sunset, wet hair, laughing, athletic build",
    "in a tailored black suit at a rooftop bar at night, city lights",
    "in a white linen kurta in a sunlit courtyard",
    "in a fitted t-shirt at a gym, glowing skin, confident smile",
    "in a leather jacket leaning on a motorbike on a coastal road",
    "in a knit sweater by a window on a rainy evening with coffee",
  ],
};

const isMale = (c: Companion) => c.gender === "men" || /\bman\b/.test(c.appearance);
const genderWord = (c: Companion) => (c.gender === "anime" ? `adult anime ${isMale(c) ? "man" : "woman"}` : isMale(c) ? "man" : "woman");
const styleFor = (c: Companion) => (c.gender === "anime" ? ANIME_STYLE : STYLE);
const mainPrompt = (c: Companion) =>
  `Waist-up portrait of ${c.appearance}, ${signature[c.gender]}, looking straight at the viewer with a warm, inviting expression, in ${c.city}. ${styleFor(c)}. ${SAFE}.`;
const lookPrompt = (c: Companion, look: string) =>
  `Keep the exact same ${genderWord(c)} from the reference photo: identical face, facial features, eyes, nose, lips, skin tone, hair and body. Now show ${isMale(c) ? "him" : "her"} ${look}. ${styleFor(c)}. ${SAFE}.`;
const looksFor = (c: Companion, i: number) => {
  const pool = looks[c.gender === "anime" ? "anime" : isMale(c) ? "men" : "women"];
  return [0, 1, 2].map((k) => pool[(i * 3 + k) % pool.length]);
};
const seedFor = (c: Companion) => Number(c.modelId.replace(/\D/g, "")) * 7919;

// ---------- fal queue ----------
async function fal(model: string, input: Record<string, unknown>): Promise<{ url: string; nsfw: boolean }> {
  const h = { Authorization: `Key ${FAL}`, "Content-Type": "application/json" };
  const sub = await fetch(`https://queue.fal.run/${model}`, { method: "POST", headers: h, body: JSON.stringify(input) });
  if (!sub.ok) throw new Error(`fal submit ${model} ${sub.status}: ${(await sub.text()).slice(0, 200)}`);
  const { status_url, response_url } = (await sub.json()) as { status_url: string; response_url: string };
  for (let t = 0; t < 120; t++) {
    await new Promise((r) => setTimeout(r, 2000));
    const st = (await (await fetch(status_url, { headers: h })).json()) as { status: string; error?: string };
    if (st.error) throw new Error(`fal ${model}: ${st.error}`);
    if (st.status === "COMPLETED") break;
  }
  const r = (await (await fetch(response_url, { headers: h })).json()) as { images?: { url: string }[]; has_nsfw_concepts?: boolean[] };
  if (!r.images?.[0]) throw new Error(`fal ${model}: no image`);
  return { url: r.images[0].url, nsfw: Boolean(r.has_nsfw_concepts?.some(Boolean)) };
}

// ---------- Claude Haiku image check (same rules as src/server/media/image-check.ts) ----------
const claude = new Anthropic({ apiKey: CHECK_KEY, timeout: 60_000, maxRetries: 2 });
async function check(url: string): Promise<string | null> {
  const res = await claude.messages.create({
    model: process.env.IMAGE_CHECK_MODEL || "claude-haiku-5-5",
    max_tokens: 400,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["allowed", "reason"],
          properties: { allowed: { type: "boolean" }, reason: { type: "string", enum: ["ok", "nudity", "sexual", "minor", "violence", "other"] } },
        },
      },
    },
    system:
      "You review AI-generated images for an adults-only companion app before users see them. ALLOW: glamour, fashion, swimwear, lingerie, cleavage, romance, clothed sensual poses. BLOCK as 'nudity': exposed genitals, exposed nipples, or fully nude bodies. BLOCK as 'sexual': depicted sexual acts. BLOCK as 'minor': any person who could plausibly be under 18. BLOCK as 'violence': gore. BLOCK as 'other': hate symbols. When unsure about age, block as 'minor'.",
    messages: [{ role: "user", content: [{ type: "image", source: { type: "url", url } }, { type: "text", text: "Review this image." }] }],
  });
  if (res.stop_reason === "refusal") return "other";
  const block = res.content.find((b) => b.type === "text");
  const v = block && block.type === "text" ? (JSON.parse(block.text) as { allowed: boolean; reason: string }) : null;
  if (!v) return "unparseable";
  return v.allowed ? null : v.reason;
}

// ---------- storage ----------
async function ensureBucket() {
  const res = await fetch(`${SUPABASE}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...sb, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"], file_size_limit: 10 * 1024 * 1024 }),
  });
  if (!res.ok && res.status !== 409 && !(await res.text()).includes("already exists")) throw new Error(`bucket ${res.status}`);
}

async function store(slug: string, name: string, srcUrl: string) {
  const file = await fetch(srcUrl);
  if (!file.ok) throw new Error(`download ${file.status}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${slug}/${name}.jpg`;
  const up = await fetch(`${SUPABASE}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...sb, "Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "31536000" },
    body: bytes,
  });
  if (!up.ok) throw new Error(`upload ${path} ${up.status}`);
  await mkdir(`${REVIEW_DIR}/${slug}`, { recursive: true });
  await writeFile(`${REVIEW_DIR}/${slug}/${name}.jpg`, bytes);
  return path;
}

/** Generate → check → retry with a new seed (max 3 tries). */
async function safeImage(label: string, make: (seed: number) => Promise<{ url: string; nsfw: boolean }>, seed: number) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const img = await make(seed + attempt * 101);
    if (img.nsfw) {
      console.log(`  ${label}: provider flagged, retrying`);
      continue;
    }
    const blocked = await check(img.url);
    if (!blocked) return img.url;
    console.log(`  ${label}: image check blocked (${blocked}), retrying`);
  }
  throw new Error(`${label}: no safe image after 3 tries`);
}

// ---------- main ----------
type Entry = { portrait: string; gallery: string[] };
const manifest = JSON.parse(await readFile(MANIFEST, "utf8").catch(() => "{}")) as Record<string, Entry>;
await ensureBucket();
const version = Date.now().toString(36);

async function run(c: Companion, i: number) {
  if (manifest[c.slug] && !force && !extrasOnly) return console.log(`skip ${c.modelId} ${c.slug} (exists; --force to redo)`);
  const seed = seedFor(c);
  console.log(`▶ ${c.modelId} ${c.slug} (seed ${seed})`);

  let mainPath = `${c.slug}/main.jpg`;
  if (!extrasOnly || !manifest[c.slug]) {
    const url = await safeImage(`${c.slug}/main`, (s) =>
      fal(BASE_MODEL, { prompt: mainPrompt(c), image_size: "portrait_4_3", num_inference_steps: 32, guidance_scale: 3.5, seed: s, num_images: 1, enable_safety_checker: true, output_format: "jpeg" }), seed);
    mainPath = await store(c.slug, "main", url);
  }

  // Extras edit the stored main photo, so the face stays locked to it.
  const reference = publicUrl(mainPath);
  const gallery: string[] = [];
  for (const [k, look] of looksFor(c, i).entries()) {
    const url = await safeImage(`${c.slug}/${k + 1}`, (s) =>
      fal(FACE_MODEL, { prompt: lookPrompt(c, look), image_url: reference, aspect_ratio: "3:4", guidance_scale: 3.5, seed: s, num_images: 1, output_format: "jpeg", safety_tolerance: "2" }), seed + k + 1);
    gallery.push(`${publicUrl(await store(c.slug, String(k + 1), url))}?v=${version}`);
  }

  const patch = await fetch(`${SUPABASE}/rest/v1/companions?slug=eq.${c.slug}`, {
    method: "PATCH",
    headers: { ...sb, "Content-Type": "application/json" },
    body: JSON.stringify({ portrait_path: mainPath }),
  });
  if (!patch.ok) throw new Error(`portrait_path ${c.slug} ${patch.status}`);
  manifest[c.slug] = { portrait: `${reference}?v=${version}`, gallery };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✓ ${c.modelId} ${c.slug}`);
}

// A few models at a time.
const queue = targets.map((c) => () => run(c, companions.indexOf(c)));
const failed: string[] = [];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        await job();
      } catch (err) {
        failed.push((err as Error).message);
        console.error("✗", (err as Error).message);
      }
    }
  }),
);
console.log(failed.length ? `\nDone with ${failed.length} failure(s). Re-run to retry them.` : "\nAll done. Review the photos in", REVIEW_DIR);
