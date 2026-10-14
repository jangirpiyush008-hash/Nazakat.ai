import { notFound } from "next/navigation";
import { FREE_DAILY_MESSAGES, getCapabilities } from "@/config/features";
import { requireOnboarded } from "@/server/session";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

type Params = Promise<{ id: string }>;

export default async function ChatPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, user, profile } = await requireOnboarded(`/app/chat/${id}`);
  const { data: convo } = await supabase.from("conversations").select("id, companion_id").eq("id", id).maybeSingle();
  if (!convo) notFound();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [{ data: companion }, { data: messages }, { data: memories }, { data: usage }] = await Promise.all([
    supabase.from("companions").select("id, slug, name, age, city, occupation, hook, wash").eq("id", convo.companion_id).single(),
    supabase.from("messages").select("id, role, content, created_at, feedback").eq("conversation_id", id).order("created_at").limit(200),
    supabase.from("memory_items").select("id, fact, category, created_at").eq("companion_id", convo.companion_id).order("created_at", { ascending: false }),
    supabase.from("daily_usage").select("messages_used").eq("user_id", user.id).eq("day", today).maybeSingle(),
  ]);
  if (!companion) notFound();

  return (
    <ChatWorkspace
      conversationId={id}
      companion={companion}
      initialMessages={(messages ?? []).filter((m) => m.role !== "system").map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content, feedback: m.feedback }))}
      initialMemories={memories ?? []}
      memoryEnabled={profile.memory_enabled}
      chatAvailable={getCapabilities().chat}
      remaining={Math.max(0, FREE_DAILY_MESSAGES - (usage?.messages_used ?? 0))}
      dailyLimit={FREE_DAILY_MESSAGES}
    />
  );
}
