import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCapabilities } from "@/config/features";
import { sparkCosts } from "@/config/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, tooMany } from "@/server/rate-limit";
import { chargeSparks, refundSparks } from "@/server/sparks";
import { speak } from "@/server/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Turns one companion reply into a voice note. Charged once; the audio is
 * cached in private storage so replays are free.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rl = rateLimit("voiceNote", user.id);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const parsed = z.object({ messageId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin || getCapabilities().voiceNotes !== "available") return NextResponse.json({ error: "unavailable" }, { status: 503 });

  // RLS: only the owner's messages are visible.
  const { data: msg } = await supabase.from("messages").select("id, role, content, conversation_id").eq("id", parsed.data.messageId).maybeSingle();
  if (!msg || msg.role !== "assistant") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const path = `${user.id}/voice/${msg.id}.mp3`;
  const cached = await admin.storage.from("generations").createSignedUrl(path, 3600);
  if (cached.data?.signedUrl) return NextResponse.json({ url: cached.data.signedUrl, cached: true });

  const [{ data: convo }, { data: profile }] = await Promise.all([
    supabase.from("conversations").select("companion_id").eq("id", msg.conversation_id).single(),
    supabase.from("profiles").select("chat_language").eq("id", user.id).single(),
  ]);
  const { data: companion } = convo ? await admin.from("companions").select("gender, voice_id").eq("id", convo.companion_id).single() : { data: null };
  if (!companion || !profile) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const cost = sparkCosts.voiceNote;
  const key = `voicenote-${msg.id}`;
  if (!(await chargeSparks(admin, user.id, cost, key, `voice_note:${msg.id}`))) return NextResponse.json({ error: "insufficient_sparks" }, { status: 402 });

  try {
    const voice = await speak(msg.content, { gender: companion.gender, voiceId: companion.voice_id, chatLanguage: profile.chat_language, userId: user.id, feature: "voice_note" });
    const { error } = await admin.storage.from("generations").upload(path, voice.audio, { contentType: voice.contentType, upsert: true });
    if (error) throw new Error(`upload ${error.message}`);
    const { data: signed } = await admin.storage.from("generations").createSignedUrl(path, 3600);
    return NextResponse.json({ url: signed?.signedUrl, cost });
  } catch (err) {
    console.error("voice_note_error", (err as Error).message);
    await refundSparks(admin, user.id, cost, `refund-${key}`, `voice_note:${msg.id}`);
    return NextResponse.json({ error: "failed", refunded: cost }, { status: 502 });
  }
}
