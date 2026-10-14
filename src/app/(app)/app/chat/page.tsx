import { companions as catalogue, languageLabels } from "@/lib/companions";
import { requireOnboarded } from "@/server/session";
import { AppHome, type RecentChat } from "@/components/app-home";
import type { FeaturedSlide } from "@/components/featured-carousel";

export const metadata = { title: "Chats" };

/** Signed-in home: featured companions, continue-chatting rail, filterable catalogue. */
export default async function ChatsPage() {
  const { supabase, profile } = await requireOnboarded("/app/chat");
  const [{ data: convos }, { data: dbCompanions }] = await Promise.all([
    supabase.from("conversations").select("id, companion_id, last_message_at").order("last_message_at", { ascending: false, nullsFirst: false }).limit(20),
    supabase.from("companions").select("id, slug").eq("status", "published"),
  ]);
  const slugById = new Map((dbCompanions ?? []).map((c) => [c.id, c.slug]));
  const published = new Set((dbCompanions ?? []).map((c) => c.slug));
  const bySlug = new Map(catalogue.map((c) => [c.slug, c]));

  // Last message per conversation for the "Continue chatting" rail.
  const ids = (convos ?? []).map((c) => c.id);
  const { data: lastMsgs } = ids.length
    ? await supabase.from("messages").select("conversation_id, role, content, created_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(200)
    : { data: [] };
  const latest = new Map<string, { role: string; content: string }>();
  for (const m of lastMsgs ?? []) if (!latest.has(m.conversation_id)) latest.set(m.conversation_id, m);

  const recent: RecentChat[] = (convos ?? []).flatMap((cv) => {
    const c = bySlug.get(slugById.get(cv.companion_id) ?? "");
    if (!c) return [];
    const last = latest.get(cv.id);
    return [{ id: cv.id, slug: c.slug, name: c.name, wash: c.wash, preview: last ? `${last.role === "user" ? "You: " : ""}${last.content}` : c.hook, at: cv.last_message_at }];
  });

  const companions = catalogue.filter((c) => published.has(c.slug));
  const forYou = profile.interest === "anime" ? companions : companions.filter((c) => c.gender === profile.interest);
  const slides: FeaturedSlide[] = (forYou.length ? forYou : companions).slice(0, 4).map((c) => ({
    slug: c.slug,
    name: c.name,
    age: c.age,
    quote: c.quote,
    wash: c.wash,
    meta: `${c.occupation} · ${c.city} · ${languageLabels[c.languages[0]].label} · AI character`,
  }));

  return <AppHome recent={recent} companions={companions} slides={slides} interest={profile.interest} />;
}
