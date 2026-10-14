"use client";

import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import type { Companion } from "@/lib/companions";
import { languageLabels } from "@/lib/companions";
import { AiPill } from "./ui";
import { useQuickView } from "./companion-quickview";

/** Portrait frame: commissioned art when present, otherwise the lighting wash. */
export function Portrait({ companion, sizes, priority }: { companion: Companion; sizes: string; priority?: boolean }) {
  return (
    <div className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-105" style={{ background: companion.wash }}>
      {companion.portrait ? (
        <Image src={companion.portrait} alt={`${companion.name}, AI character portrait`} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <span className="absolute inset-x-0 top-1/2 text-center font-mono text-[11px] text-ink-3/70">portrait · {companion.name}</span>
      )}
    </div>
  );
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n);
}

export function CharacterCard({
  companion,
  showTags = true,
  href,
  ctaAlwaysVisible = false,
  className,
}: {
  companion: Companion;
  showTags?: boolean;
  /** Defaults to the public profile; the signed-in app links straight into chat. */
  href?: string;
  ctaAlwaysVisible?: boolean;
  className?: string;
}) {
  const c = companion;
  const quickView = useQuickView();
  return (
    <Link
      href={href ?? `/companions/${c.slug}`}
      onClick={(e) => {
        // Plain click opens the quick view; cmd/ctrl-click still opens the page.
        if (!quickView || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        quickView(c);
      }}
      className={clsx(
        "group relative block aspect-[3/4] overflow-hidden rounded-[20px] transition-all duration-200 ease-out",
        "hover:-translate-y-1.5 hover:shadow-[0_0_0_2px_#FF2E7E,0_20px_60px_rgba(255,46,126,.3)]",
        className,
      )}
    >
      <Portrait companion={c} sizes="(max-width: 768px) 50vw, 20vw" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(10,7,9,.95)_92%)]" />
      <span className="absolute left-2.5 top-2.5">
        <AiPill />
      </span>
      {c.badge === "hot" && (
        <span className="absolute right-2.5 top-2.5 inline-flex h-[22px] items-center rounded-full bg-sindoor px-2 text-[10px] font-bold">HOT</span>
      )}
      {c.badge === "new" && (
        <span className="absolute right-2.5 top-2.5 inline-flex h-[22px] items-center rounded-full bg-marigold px-2 text-[10px] font-bold text-on-gold">NEW</span>
      )}
      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-xl md:text-[21px]">{c.name}</span>
          <span className="text-xs text-ink-2">
            {c.age} · {c.city}
          </span>
        </div>
        <p className="font-display text-[13px] italic">{c.hook}</p>
        {showTags && (
          <div className="flex gap-1.5">
            <span className="rounded-full bg-white/10 px-2 py-[3px] text-[11px]">{languageLabels[c.languages[0]].label}</span>
            <span className="rounded-full bg-white/10 px-2 py-[3px] text-[11px]">{c.vibes[0]}</span>
          </div>
        )}
        {c.chatsTonight !== null && (
          <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="size-1.5 rounded-full bg-marigold" />
            {formatCount(c.chatsTonight)} chats tonight
          </div>
        )}
        <span className={clsx("bg-saanjh mt-1 h-9 items-center justify-center rounded-[10px] text-[13px] font-semibold text-white", ctaAlwaysVisible ? "flex" : "hidden group-hover:flex group-focus-visible:flex")}>
          Chat now →
        </span>
      </div>
    </Link>
  );
}
