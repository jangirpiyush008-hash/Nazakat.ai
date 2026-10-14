// Cross-user RLS check against a live project through the public API.
// Creates two throwaway users, checks isolation, then deletes them.
// Run: node --env-file=.env.local scripts/rls-check.ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => results.push([name, ok, detail]);

async function makeUser(tag: string) {
  const email = `rls-${tag}-${Date.now()}@example.com`;
  const password = crypto.randomUUID();
  const u = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) }).then((r) => r.json());
  const t = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }).then((r) => r.json());
  if (!u.id || !t.access_token) throw new Error(`user ${tag}: ${JSON.stringify(u).slice(0, 200)} ${JSON.stringify(t).slice(0, 200)}`);
  return { id: u.id as string, h: { apikey: anon, Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json" } };
}
const rest = (path: string, h: Record<string, string>, init: RequestInit = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...h, Prefer: "return=representation", ...(init.headers ?? {}) } });

const A = await makeUser("a");
const B = await makeUser("b");
try {
  const prof = await rest(`profiles?id=eq.${A.id}&select=id`, A.h).then((r) => r.json());
  check("profile auto-created on sign-up", prof.length === 1);
  const onb = await rest("rpc/complete_onboarding", A.h, { method: "POST", body: JSON.stringify({ consent_version: "test", analytics: false, marketing: false, interest: "women", chat_language: "hinglish" }) });
  check("onboarding RPC works", onb.ok, String(onb.status));

  const [comp] = await rest("companions?slug=eq.meera&select=id", A.h).then((r) => r.json());
  const [conv] = await rest("conversations", A.h, { method: "POST", body: JSON.stringify({ user_id: A.id, companion_id: comp.id }) }).then((r) => r.json());
  await rest("messages", admin, { method: "POST", body: JSON.stringify({ conversation_id: conv.id, user_id: A.id, role: "user", content: "secret from A" }) });
  const [mem] = await rest("memory_items", A.h, { method: "POST", body: JSON.stringify({ user_id: A.id, companion_id: comp.id, fact: "A likes cutting chai" }) }).then((r) => r.json());
  await rest("credit_ledger", admin, { method: "POST", body: JSON.stringify({ user_id: A.id, kind: "grant", bucket: "promo", amount: 20, idempotency_key: `rls-${A.id}` }) });

  const count = async (path: string, h = B.h) => (await rest(path, h).then((r) => r.json())).length as number;
  check("B can't read A's conversations", (await count("conversations?select=id")) === 0);
  check("B can't read A's messages", (await count("messages?select=id")) === 0);
  check("B can't read A's memories", (await count("memory_items?select=id")) === 0);
  check("B can't read A's ledger", (await count("credit_ledger?select=id")) === 0);
  check("B can't read other profiles", (await count(`profiles?id=neq.${B.id}&select=id`)) === 0);
  check("B can't read persona prompts", (await count("companion_personas?select=companion_id")) === 0);
  check("B can read the 9 published companions", (await count("companions?select=id")) === 9);
  check("A can read own message", (await count("messages?select=id", A.h)) === 1);

  const mint = await rest("credit_ledger", B.h, { method: "POST", body: JSON.stringify({ user_id: B.id, kind: "grant", bucket: "promo", amount: 1000, idempotency_key: `mint-${B.id}` }) });
  check("B can't mint Sparks", !mint.ok, String(mint.status));
  const fake = await rest("messages", B.h, { method: "POST", body: JSON.stringify({ conversation_id: conv.id, user_id: B.id, role: "assistant", content: "fake" }) });
  check("B can't insert messages", !fake.ok, String(fake.status));
  const age = await rest(`profiles?id=eq.${B.id}`, B.h, { method: "PATCH", body: JSON.stringify({ age_confirmed_at: new Date().toISOString() }) });
  check("B can't self-confirm age", !age.ok, String(age.status));
  const del = await rest(`memory_items?id=eq.${mem.id}`, B.h, { method: "DELETE" }).then((r) => r.json());
  check("B can't delete A's memory", Array.isArray(del) && del.length === 0);
  const meter = await rest("rpc/consume_daily_message", B.h, { method: "POST", body: JSON.stringify({ uid: B.id, daily_limit: 60 }) });
  check("B can't call the metering function", !meter.ok, String(meter.status));
  const bal = await rest("rpc/spark_balance", A.h, { method: "POST", body: "{}" }).then((r) => r.json());
  check("A sees own Spark balance (20)", bal === 20, String(bal));
} finally {
  for (const u of [A, B]) await fetch(`${url}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: admin });
}
for (const [name, ok, detail] of results) console.log(ok ? "PASS" : "FAIL", name, detail && `(${detail})`);
console.log(`${results.filter((r) => r[1]).length}/${results.length} passed`);
if (results.some((r) => !r[1])) process.exit(1);
