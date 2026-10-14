import { notFound } from "next/navigation";
import { FREE_DAILY_MESSAGES, getCapabilities } from "@/config/features";
import { createAdminClient } from "@/lib/supabase/admin";
import { availableDurations } from "@/server/media/fal";
import type { VideoDuration } from "@/config/pricing";
import { requireOnboarded } from "@/server/session";
import { ChatWorkspace, type MediaRef } from "@/components/chat/chat-workspace";

type Params = Promise<{ id: string }>;

export default async function ChatPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, user, profile } = await requireOnboarded(`/app/chat/${id}`);
  const { data: convo } = await supabase.from("conversations").select("id, companion_id").eq("id", id).maybeSingle();
  if (!convo) notFound();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [{ data: companion }, { data: messages }, { data: memories }, { data: usage }, { data: balance }] = await Promise.all([
    supabase.from("companions").select("id, slug, name, age, city, occupation, hook, wash").eq("id", convo.companion_id).single(),
    supabase.from("messages").select("id, role, content, created_at, feedback, media_id").eq("conversation_id", id).order("created_at").limit(200),
    supabase.from("memory_items").select("id, fact, category, created_at").eq("companion_id", convo.companion_id).order("created_at", { ascending: false }),
    supabase.from("daily_usage").select("messages_used").eq("user_id", user.id).eq("day", today).maybeSingle(),
    supabase.rpc("spark_balance"),
  ]);
  if (!companion) notFound();

  // Signed URLs for media in this conversation (private bucket, 1 hour).
  const mediaIds = (messages ?? []).flatMap((m) => (m.media_id ? [m.media_id] : []));
  const media = new Map<string, MediaRef>();
  const admin = createAdminClient();
  if (mediaIds.length && admin) {
    const { data: assets } = await supabase.from("media_assets").select("id, kind, storage_path, duration_s").in("id", mediaIds);
    const { data: signed } = await admin.storage.from("generations").createSignedUrls((assets ?? []).map((a) => a.storage_path), 3600);
    (assets ?? []).forEach((a, i) => media.set(a.id, { id: a.id, kind: a.kind, url: signed?.[i]?.signedUrl ?? null, duration: a.duration_s }));
  }

  const caps = getCapabilities();
  return (
    <ChatWorkspace
      conversationId={id}
      companion={companion}
      initialMessages={(messages ?? [])
        .filter((m) => m.role !== "system")
        .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content, feedback: m.feedback, media: m.media_id ? (media.get(m.media_id) ?? null) : null }))}
      initialMemories={memories ?? []}
      memoryEnabled={profile.memory_enabled}
      chatAvailable={caps.chat}
      features={{ image: caps.image === "available", video: caps.video === "available", voice: caps.voice === "available", voiceNotes: caps.voiceNotes === "available" }}
      balance={Math.max(0, balance ?? 0)}
      videoDurations={availableDurations() as VideoDuration[]}
      remaining={Math.max(0, FREE_DAILY_MESSAGES - (usage?.messages_used ?? 0))}
      dailyLimit={FREE_DAILY_MESSAGES}
    />
  );
}
