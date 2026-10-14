import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = z.object({ callId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  const admin = createAdminClient();
  if (!parsed.success || !admin) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data: call } = await supabase.from("call_sessions").select("id, minutes_charged, sparks_per_minute").eq("id", parsed.data.callId).maybeSingle();
  if (!call) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await admin.from("call_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", call.id).eq("status", "active");
  return NextResponse.json({ minutes: call.minutes_charged, sparks: call.minutes_charged * call.sparks_per_minute });
}
