import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCapabilities } from "@/config/features";
import { sparkCosts } from "@/config/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { billCallMinutes } from "@/server/calls";

export const runtime = "nodejs";

/** Starts a voice call and charges the first minute up front. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = z.object({ conversationId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin || getCapabilities().voice !== "available") return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const { data: convo } = await supabase.from("conversations").select("id, companion_id").eq("id", parsed.data.conversationId).maybeSingle();
  if (!convo) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // One active call per user.
  await admin.from("call_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("user_id", auth.user.id).eq("status", "active");
  const { data: call } = await admin
    .from("call_sessions")
    .insert({ user_id: auth.user.id, companion_id: convo.companion_id, conversation_id: convo.id, sparks_per_minute: sparkCosts.voicePerMinute })
    .select("*")
    .single();
  if (!call) return NextResponse.json({ error: "failed" }, { status: 500 });

  const bill = await billCallMinutes(admin, call);
  if (!bill.ok) {
    await admin.from("call_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", call.id);
    return NextResponse.json({ error: "insufficient_sparks" }, { status: 402 });
  }
  return NextResponse.json({ id: call.id, sparksPerMinute: call.sparks_per_minute });
}
