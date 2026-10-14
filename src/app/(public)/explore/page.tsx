import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import {
  allInterests,
  allVibes,
  companions,
  findCompanions,
  languageLabels,
  type CompanionFilters,
} from "@/lib/companions";
import { cookies } from "next/headers";
import { Search } from "lucide-react";
import { CharacterCard } from "@/components/character-card";
import { FeaturedCarousel, type FeaturedSlide } from "@/components/featured-carousel";
import { INTEREST_COOKIE } from "@/lib/prefs";
import { Chip, GlassLink, PrimaryLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Explore companions",
  description: "Browse original fictional AI companions by language, vibe and interests.",
  alternates: { canonical: "/explore" },
};

const filterSchema = z.object({
  gender: z.enum(["women", "men", "anime"]).optional().catch(undefined),
  vibe: z.enum(allVibes).optional().catch(undefined),
  interest: z.enum(allInterests).optional().catch(undefined),
  q: z.string().max(60).optional().catch(undefined),
});

type SP = Promise<Record<string, string | string[] | undefined>>;

function hrefWith(current: CompanionFilters, key: keyof CompanionFilters, value?: string) {
  const next = { ...current, [key]: current[key] === value ? undefined : value };
  const params = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => Boolean(e[1])));
  const s = params.toString();
  return s ? `/explore?${s}` : "/explore";
}

export default async function ExplorePage({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams;
  const filters: CompanionFilters = filterSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  // No explicit category: fall back to the age-gate "interested in" choice.
  filters.gender ??= filterSchema.shape.gender.parse((await cookies()).get(INTEREST_COOKIE)?.value);
  const results = findCompanions(filters);
  const slides: FeaturedSlide[] = [...companions]
    .sort((a, b) => Number(b.badge === "hot") - Number(a.badge === "hot"))
    .filter((c) => !filters.gender || c.gender === filters.gender)
    .slice(0, 4)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      age: c.age,
      quote: c.quote,
      wash: c.wash,
      portrait: c.portrait,
      meta: `${c.occupation} · ${c.city} · ${languageLabels[c.languages[0]].label} · AI character`,
    }));
  const hasFilters = Boolean(filters.language || filters.vibe || filters.interest || filters.q);

  return (
    <>
      <main className="pb-16">
        <h1 className="sr-only">Explore AI companions</h1>
        <div className="mx-5 mt-6 md:mx-8 md:mt-8 2xl:mx-12">
          <FeaturedCarousel slides={slides} />
        </div>

        {/* Search */}
        <form action="/explore" className="mx-5 mt-6 flex gap-2 md:mx-8 2xl:mx-12" role="search">
          {filters.gender && <input type="hidden" name="gender" value={filters.gender} />}
          <label htmlFor="q" className="sr-only">Search companions</label>
          <div className="flex h-12 flex-1 items-center gap-2.5 rounded-full bg-surface px-4 focus-within:shadow-[0_0_0_1px_#FF2E7E,0_0_0_4px_rgba(255,46,126,.2)]">
            <Search className="size-[18px] text-ink-3" aria-hidden />
            <input id="q" name="q" defaultValue={filters.q} maxLength={60} placeholder="Search by name, city or vibe…" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
          </div>
          <button type="submit" className="bg-saanjh h-12 rounded-full px-5 text-sm font-semibold text-white">Search</button>
        </form>

        {/* Filters */}
        <section aria-label="Filters" className="sticky top-[57px] z-30 mx-5 mt-6 flex flex-col gap-2.5 rounded-2xl bg-surface/80 px-4 py-3 backdrop-blur-[20px] md:top-[73px] md:mx-8 2xl:mx-12">
          <p className="text-[12px] text-ink-3">Every companion chats in English, Hindi or Hinglish — pick yours in Settings.</p>
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="w-[84px] flex-none text-[11px] tracking-[.1em] text-ink-3">VIBE</span>
            {allVibes.map((v) => (
              <Chip key={v} href={hrefWith(filters, "vibe", v)} selected={filters.vibe === v}>
                {v}
              </Chip>
            ))}
            <span className="mx-1.5 h-5 w-px flex-none bg-white/10" />
            <span className="flex-none text-[11px] tracking-[.1em] text-ink-3">INTERESTS</span>
            {allInterests.map((i) => (
              <Chip key={i} href={hrefWith(filters, "interest", i)} selected={filters.interest === i}>
                {i}
              </Chip>
            ))}
          </div>
        </section>

        {/* Results */}
        <section aria-live="polite" className="px-5 pt-6 md:px-8 2xl:px-12">
          {results.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
              {results.map((c) => (
                <CharacterCard key={c.slug} companion={c} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-[20px] bg-surface p-10 text-center">
              <div className="flex size-[72px] items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(255,46,126,.35),transparent_70%)] text-[28px]">
                🌙
              </div>
              <h2 className="font-display text-[26px]">No companions found{hasFilters ? " for these filters" : ""}</h2>
              <p className="max-w-[360px] text-sm leading-normal text-ink-2">
                {filters.gender === "anime"
                  ? "Anime companions are on the way. Explore everyone else for now."
                  : "Try fewer filters, or tell us who you'd like to meet next."}
              </p>
              <div className="flex gap-2.5">
                <GlassLink href={filters.gender ? `/explore?gender=${filters.gender}` : "/explore"} className="!h-[42px] !text-[13px]">
                  Clear filters
                </GlassLink>
                <PrimaryLink href="/contact?topic=companion-request" className="!h-[42px] !text-[13px]">
                  Request a companion
                </PrimaryLink>
              </div>
            </div>
          )}
          {hasFilters && results.length > 0 && (
            <p className="mt-6 text-center text-sm text-ink-3">
              Showing {results.length} of {companions.length}.{" "}
              <Link href="/explore" className="text-rani">
                Clear filters
              </Link>
            </p>
          )}
        </section>
      </main>
    </>
  );
}
