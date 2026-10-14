"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";
import { allVibes, type Companion, type Gender } from "@/lib/companions";
import { CharacterCard } from "./character-card";
import { FeaturedCarousel, type FeaturedSlide } from "./featured-carousel";

export type RecentChat = { id: string; slug: string; name: string; wash: string; portrait?: string; preview: string; at: string | null };

function ago(iso: string | null) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 5 ? "Up late?" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Long night?";
}

const chatHref = (slug: string) => `/app/chat/new?c=${slug}`;

export function AppHome({ recent, companions, slides, interest }: { recent: RecentChat[]; companions: Companion[]; slides: FeaturedSlide[]; interest: Gender }) {
  const [gender, setGender] = useState<Gender | "all">(interest === "anime" ? "all" : interest);
  const [vibe, setVibe] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return companions.filter(
      (c) =>
        (gender === "all" || c.gender === gender) &&
        (!vibe || c.vibes.includes(vibe)) &&
        (!needle || [c.name, c.city, c.occupation, ...c.vibes, ...c.interests].some((s) => s.toLowerCase().includes(needle))),
    );
  }, [companions, gender, vibe, q]);

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-6 md:px-8">
      <header className="flex items-end justify-between gap-4">
        <h1 className="font-display text-[34px] font-light leading-none md:text-[44px]">
          {greeting()} <span className="text-gradient italic">✦</span>
        </h1>
      </header>

      <FeaturedCarousel slides={slides} hrefFor={chatHref} />

      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-light">Continue chatting</h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/app/chat/${r.id}`}
                className="flex w-[280px] flex-none snap-start items-center gap-3 rounded-2xl bg-surface p-3 transition-colors hover:bg-elevated"
              >
                <span className="relative size-14 flex-none overflow-hidden rounded-full shadow-[0_0_0_2px_#FF2E7E]" style={{ background: r.wash }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- avatar crop of the public portrait */}
                  {r.portrait && <img src={r.portrait} alt="" className="size-full object-cover object-top" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-[11px] text-ink-3">{ago(r.at)}</span>
                  </span>
                  <span className="line-clamp-2 text-[13px] leading-snug text-ink-2">{r.preview}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-display text-2xl font-light">
            <span className="text-gradient italic">Explore</span> companions
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex h-10 items-center gap-2 rounded-full bg-surface px-3.5 focus-within:shadow-[0_0_0_1px_#FF2E7E]">
              <Search className="size-4 text-ink-3" aria-hidden />
              <label htmlFor="home-search" className="sr-only">Search companions</label>
              <input id="home-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, city, vibe…" className="w-36 bg-transparent text-sm outline-none placeholder:text-ink-3 md:w-48" />
            </div>
            <div className="flex gap-1 rounded-full bg-surface p-1" role="tablist" aria-label="Category">
              {(["women", "men", "all"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={gender === g}
                  onClick={() => setGender(g)}
                  className={clsx("h-8 rounded-full px-3.5 text-[13px] capitalize", gender === g ? "bg-wine font-semibold text-rani" : "text-ink-2 hover:text-ink")}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {[null, ...allVibes].map((v) => (
            <button
              key={v ?? "all"}
              type="button"
              aria-pressed={vibe === v}
              onClick={() => setVibe(v)}
              className={clsx("inline-flex h-9 flex-none items-center rounded-full px-4 text-[13px]", vibe === v ? "border border-rani bg-wine font-semibold text-rani" : "bg-elevated text-ink-2 hover:text-ink")}
            >
              {v ?? "All"}
            </button>
          ))}
        </div>

        {shown.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {shown.map((c) => (
              <CharacterCard key={c.slug} companion={c} href={chatHref(c.slug)} ctaAlwaysVisible />
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] bg-surface p-8 text-center text-sm text-ink-2">
            No companions match that.{" "}
            <button type="button" onClick={() => { setVibe(null); setQ(""); setGender("all"); }} className="font-semibold text-rani">
              Show everyone
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
