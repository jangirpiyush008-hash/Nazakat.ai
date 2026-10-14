"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { INTEREST_COOKIE, readCookie, setPrefCookie } from "@/lib/prefs";

const genders = [
  { id: "women", label: "Women" },
  { id: "men", label: "Men" },
  { id: "anime", label: "Anime" },
] as const;

export function GenderToggle() {
  const params = useSearchParams();
  const pathname = usePathname();
  const [saved, setSaved] = useState<string>();
  useEffect(() => setSaved(readCookie(INTEREST_COOKIE)), []);
  const value = params.get("gender") ?? saved ?? "women";
  // On Explore, keep the other filters; elsewhere, go to Explore.
  const base = pathname === "/explore" ? new URLSearchParams(params) : new URLSearchParams();

  return (
    <nav aria-label="Companion category" className="flex gap-[3px] rounded-full bg-surface p-[3px] md:gap-1 md:p-1">
      {genders.map((g) => {
        base.set("gender", g.id);
        const active = g.id === value;
        return (
          <Link
            key={g.id}
            href={`/explore?${base.toString()}`}
            onClick={() => setPrefCookie(INTEREST_COOKIE, g.id)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "inline-flex h-7 items-center rounded-full px-3 text-xs md:h-8 md:px-4 md:text-[13px]",
              active ? "bg-wine font-semibold text-rani" : "text-ink-2 hover:text-ink",
            )}
          >
            {g.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function GenderToggleFallback() {
  return <div className="h-[34px] w-[200px] rounded-full bg-surface md:h-10 md:w-[230px]" />;
}
