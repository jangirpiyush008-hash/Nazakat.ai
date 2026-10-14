"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { HelpCircle, Languages } from "lucide-react";
import { navItems } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-[73px] hidden h-[calc(100dvh-73px)] flex-col gap-1 overflow-y-auto border-r border-white/[.06] bg-surface px-3 py-4 lg:flex">
      <nav aria-label="Main" className="flex flex-col gap-1">
        {navItems.map(({ label, href, icon: Icon, premium }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const target = href;
          if (premium)
            return (
              <Link key={label} href={target} className="bg-saanjh mt-3 rounded-[14px] p-px">
                <span className="flex h-11 items-center gap-3 rounded-[13px] bg-surface px-3 text-sm font-semibold">
                  <Icon className="size-[18px] text-marigold" aria-hidden />
                  {label}
                  <span className="ml-auto text-xs font-bold text-marigold">✦</span>
                </span>
              </Link>
            );
          return (
            <Link
              key={label}
              href={target}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex h-11 items-center gap-3 rounded-[14px] px-3 text-sm transition-colors",
                active ? "bg-elevated font-semibold text-ink" : "text-ink-2 hover:bg-elevated/60 hover:text-ink",
              )}
            >
              <Icon className={clsx("size-[18px]", active && "text-rani")} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1 border-t border-white/[.06] pt-3 text-sm text-ink-2">
        <span className="flex h-10 items-center gap-3 px-3">
          <Languages className="size-[18px]" aria-hidden />
          English · <span className="font-deva">हिंदी</span>
          <span className="ml-auto text-[10px] text-ink-3">soon</span>
        </span>
        <Link href="/help" className="flex h-10 items-center gap-3 rounded-[14px] px-3 hover:text-ink">
          <HelpCircle className="size-[18px]" aria-hidden />
          Help
        </Link>
        <div className="flex gap-3 px-3 pt-2 text-xs text-ink-3">
          <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
          <Link href="/legal/ai-disclosure" className="hover:text-ink">Trust &amp; safety</Link>
        </div>
      </div>
    </aside>
  );
}
