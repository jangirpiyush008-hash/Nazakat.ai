"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Compass, MessageCircle, Plus, User } from "lucide-react";

/** Mobile tab bar (design §Components): Explore · Chats · Create · Sparks · Profile. */
export function BottomTabs() {
  const pathname = usePathname();
  const tab = (href: string, label: string, icon: React.ReactNode, match = href) => {
    const active = pathname.startsWith(match);
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={clsx("flex flex-1 flex-col items-center gap-1 py-2 text-[11px]", active ? "text-ink" : "text-ink-3")}>
        {icon}
        {label}
        <span className={clsx("h-[3px] w-5 rounded-full", active ? "bg-saanjh" : "bg-transparent")} />
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-white/[.07] bg-bg/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-[20px] md:hidden">
      {tab("/explore", "Explore", <Compass className="size-5" aria-hidden />)}
      {tab("/app/chat", "Chats", <MessageCircle className="size-5" aria-hidden />)}
      <Link href="/create" className="flex flex-1 flex-col items-center gap-1 pb-2 text-[11px] text-ink-2">
        <span className="bg-saanjh -mt-4 flex size-10 items-center justify-center rounded-full text-white shadow-glow-sm">
          <Plus className="size-5" aria-hidden />
        </span>
        Create
      </Link>
      {tab("/pricing", "Sparks", <span className="text-lg leading-5 text-marigold" aria-hidden>✦</span>)}
      {tab("/app/settings", "Profile", <User className="size-5" aria-hidden />)}
    </nav>
  );
}
