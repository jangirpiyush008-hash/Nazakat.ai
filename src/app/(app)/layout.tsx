import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Images, MessageCircle, Settings } from "lucide-react";
import { brand } from "@/config/brand";
import { getUser } from "@/lib/supabase/server";
import { DiscreetGuard } from "@/components/discreet-guard";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Signed-in shell: compact header on desktop, tab bar on mobile. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("discreet_mode").eq("id", user.id).maybeSingle()
    : { data: null };
  const { data: balance } = user ? await supabase.rpc("spark_balance") : { data: null };
  const discreet = Boolean(profile?.discreet_mode);

  return (
    <DiscreetGuard enabled={discreet}>
      <header className="sticky top-0 z-40 border-b border-white/[.07] bg-bg/80 backdrop-blur-[20px]">
        <div className="flex h-14 items-center justify-between gap-4 px-4 md:h-16 md:px-8">
          <Link href="/app/chat" aria-label={discreet ? "Notes" : `${brand.name} chats`}>
            {discreet ? <span className="font-ui text-xl font-semibold">Notes</span> : <Wordmark />}
          </Link>
          <nav aria-label="App" className="hidden items-center gap-6 text-sm text-ink-2 md:flex">
            <Link href="/app/chat" className="hover:text-ink">Chats</Link>
            <Link href="/app/gallery" className="hover:text-ink">Gallery</Link>
            <Link href="/explore" className="hover:text-ink">Discover</Link>
            <Link href="/app/settings" className="hover:text-ink">Settings</Link>
          </nav>
          {balance !== null && (
            <Link href="/app/wallet" className="inline-flex h-8 items-center rounded-full bg-marigold/12 px-3 text-[13px] font-bold text-marigold">
              ✦ {balance}
            </Link>
          )}
        </div>
      </header>
      <div className="pb-20 md:pb-0">{children}</div>
      <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/[.07] bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-[20px] md:hidden">
        {[
          ["/app/chat", "Chats", <MessageCircle key="c" className="size-5" aria-hidden />],
          ["/app/gallery", "Gallery", <Images key="g" className="size-5" aria-hidden />],
          ["/explore", "Discover", <Compass key="d" className="size-5" aria-hidden />],
          ["/app/settings", "Settings", <Settings key="s" className="size-5" aria-hidden />],
        ].map(([href, label, icon]) => (
          <Link key={href as string} href={href as string} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] text-ink-2">
            {icon}
            {label}
          </Link>
        ))}
      </nav>
    </DiscreetGuard>
  );
}
