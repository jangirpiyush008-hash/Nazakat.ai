// Rewrites companion rows and persona prompts from src/lib/companions.ts via the
// Supabase REST API (service role). Safe to re-run; matches rows by slug.
// Run: node --env-file=.env.local scripts/sync-companions.ts
import { companions } from "../src/lib/companions.ts";
import { personaFor } from "./personas.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json; charset=utf-8", Prefer: "return=representation" };

for (const [i, c] of companions.entries()) {
  const row = {
    name: c.name, age: c.age, city: c.city, occupation: c.occupation, gender: c.gender,
    languages: c.languages, vibes: c.vibes, interests: c.interests, traits: c.traits,
    hook: c.hook, quote: c.quote, bio: c.bio, badge: c.badge ?? null, wash: c.wash,
    status: "published", sort_order: (i + 1) * 10,
  };
  const res = await fetch(`${url}/rest/v1/companions?slug=eq.${c.slug}`, { method: "PATCH", headers, body: JSON.stringify(row) });
  const [updated] = (await res.json()) as { id: string }[];
  if (!res.ok || !updated) throw new Error(`companion ${c.slug}: ${res.status}`);
  const p = await fetch(`${url}/rest/v1/companion_personas?companion_id=eq.${updated.id}`, { method: "PATCH", headers, body: JSON.stringify({ system_prompt: personaFor(c) }) });
  if (!p.ok) throw new Error(`persona ${c.slug}: ${p.status}`);
  console.log("synced", c.slug);
}
