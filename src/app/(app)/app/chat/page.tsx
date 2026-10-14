import Link from "next/link";
import { requireOnboarded } from "@/server/session";

export const metadata = { title: "Chats" };

function ago(iso: string | null) {
  if (!iso) return "New";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

export default async function ChatsPage() {
  const { supabase, profile } = await requireOnboarded("/app/chat");
  const [{ data: convos }, { data: companions }] = await Promise.all([
    supabase.from("conversations").select("id, companion_id, last_message_at").order("last_message_at", { ascending: false, nullsFirst: false }).limit(50),
    supabase.from("companions").select("id, slug, name, age, city, hook, wash, gender").order("sort_order"),
  ]);
  const byId = new Map((companions ?? []).map((c) => [c.id, c]));
  const chatting = new Set((convos ?? []).map((c) => c.companion_id));
  const suggestions = (companions ?? []).filter((c) => !chatting.has(c.id) && (profile.interest === "anime" || c.gender === profile.interest)).slice(0, 6);

  return (
    <main className="mx-auto flex max-w-[760px] flex-col gap-8 px-4 py-6 md:py-10">
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-[32px] font-light">Chats</h1>
        {convos?.length ? (
          <ul className="flex flex-col gap-1">
            {convos.map((cv) => {
              const c = byId.get(cv.companion_id);
              if (!c) return null;
              return (
                <li key={cv.id}>
                  <Link href={`/app/chat/${cv.id}`} className="flex items-center gap-3.5 rounded-2xl p-3 hover:bg-surface">
                    <span className="size-12 flex-none rounded-full shadow-[0_0_0_2px_#FFB423]" style={{ background: c.wash }} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-xs text-ink-3">{ago(cv.last_message_at)}</span>
                      </span>
                      <span className="block truncate text-[13px] text-ink-2">{c.hook}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl bg-surface p-5 text-sm text-ink-2">No chats yet. Pick someone below to start.</p>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="label-caps text-ink-3">Start a new chat</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {suggestions.map((c) => (
              <Link key={c.id} href={`/app/chat/new?c=${c.slug}`} className="relative flex aspect-[3/4] items-end overflow-hidden rounded-[20px] p-3" style={{ background: c.wash }}>
                <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(10,7,9,.95)_92%)]" />
                <span className="relative">
                  <span className="block font-display text-xl">{c.name}</span>
                  <span className="text-xs text-ink-2">{c.age} · {c.city}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
