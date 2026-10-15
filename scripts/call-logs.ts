// Prints the latest call diagnostics uploaded by /api/call/end (timeline only — no audio or words).
// Run: node --env-file=.env.local scripts/call-logs.ts [count]
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const count = Number(process.argv[2] ?? 1);
const days = (await (await fetch(`${url}/storage/v1/object/list/diagnostics`, { method: "POST", headers: h, body: JSON.stringify({ prefix: "calls/", limit: 100 }) })).json()) as { name: string }[];
if (!Array.isArray(days) || !days.length) {
  console.log("No call logs yet.");
  process.exit(0);
}
const day = days.map((d) => d.name).sort().at(-1);
const files = (await (await fetch(`${url}/storage/v1/object/list/diagnostics`, { method: "POST", headers: h, body: JSON.stringify({ prefix: `calls/${day}/`, limit: 100, sortBy: { column: "created_at", order: "desc" } }) })).json()) as { name: string }[];
for (const f of files.slice(0, count)) {
  const j = (await (await fetch(`${url}/storage/v1/object/diagnostics/calls/${day}/${f.name}`, { headers: h })).json()) as { ua: string; log: string[] };
  console.log(`\n== ${day}/${f.name}\n${j.ua}\n${j.log.join("\n")}`);
}
