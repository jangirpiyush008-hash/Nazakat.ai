import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // `log`: the device's call timeline (phases, audio state, mic levels), kept for debugging. No audio, no words.
  const parsed = z
    .object({ callId: z.string().uuid(), log: z.array(z.string().max(200)).max(400).optional() })
    .safeParse(await request.json().catch(() => null));
  const admin = createAdminClient();
  if (!parsed.success || !admin) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data: call } = await supabase.from("call_sessions").select("id, minutes_charged, sparks_per_minute").eq("id", parsed.data.callId).maybeSingle();
  if (!call) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await admin.from("call_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", call.id).eq("status", "active");
  if (parsed.data.log?.length) {
    await admin.storage.createBucket("diagnostics", { public: false }).catch(() => {});
    const day = new Date().toISOString().slice(0, 10);
    const body = JSON.stringify({ ua: request.headers.get("user-agent"), log: parsed.data.log });
    await admin.storage.from("diagnostics").upload(`calls/${day}/${call.id}.json`, body, { contentType: "application/json", upsert: true }).catch(() => {});
  }
  return NextResponse.json({ minutes: call.minutes_charged, sparks: call.minutes_charged * call.sparks_per_minute });
}
