import Link from "next/link";
import { brand } from "@/config/brand";
import { formatINR, plusOffer, weeklyPass } from "@/config/pricing";
import { companions } from "@/lib/companions";
import { CharacterCard, Portrait } from "@/components/character-card";
import { TrendingHeading } from "@/components/trending-heading";
import { AiPill, Glow, GlassLink, PrimaryLink, SectionTitle } from "@/components/ui";

const collage = [
  { slug: "zoya", w: 210, h: 290, left: 0, top: 60, dur: "7s", delay: "0s" },
  { slug: "meera", w: 230, h: 320, left: 180, top: 0, dur: "8s", delay: "1s" },
  { slug: "kabir", w: 210, h: 290, left: 400, top: 90, dur: "7.5s", delay: ".5s" },
  { slug: "anaya", w: 200, h: 270, left: 250, top: 330, dur: "9s", delay: "1.5s" },
];

const vibes = [
  { label: "Romantic", short: "Romantic", tint: "rgba(255,46,126,.55)" },
  { label: "Flirty", short: "Flirty", tint: "rgba(255,106,61,.5)" },
  { label: "Poetry", short: "Poetry", tint: "rgba(255,180,35,.45)", vibe: "Poetic" },
  { label: "Late-night talks", short: "Late-night", tint: "rgba(255,46,126,.4)" },
  { label: "Bollywood drama", short: "Bollywood", tint: "rgba(225,29,72,.5)" },
  { label: "Slow-burn", short: "Slow-burn", tint: "rgba(255,106,61,.4)" },
];

const steps = [
  ["Pick a companion", "Original, fictional adults with their own boundaries."],
  ["Talk your way", "Hinglish, Hindi or English. Voice and images when available."],
  ["Own the memory", "See, edit or delete anything remembered. Any time."],
];

const faqs = [
  ["Are the characters real people?", `No. Every ${brand.name} companion is an original, AI-generated fictional character. No real person is on the other side, and companions will never claim to be human.`],
  [`What does ${brand.name} remember?`, `Short facts you share, like a nickname or a favourite place. Every one is visible in “What ${brand.name} remembers” where you can edit or delete it. Whole conversations are never stored as memory.`],
  ["Is this therapy?", "No. Companions are for conversation, entertainment and creativity. They are not therapy, medical advice or an emergency service."],
  ["How do I delete everything?", "Settings → Privacy → Delete account. We explain exactly what is deleted and anything we must retain for legal or security reasons before you confirm."],
];

const yearly = plusOffer("yearly");

export default function HomePage() {
  const trending = companions.slice(0, 6);
  const bySlug = Object.fromEntries(companions.map((c) => [c.slug, c]));

  return (
    <div className="relative overflow-hidden">
      <Glow size={900} className="-top-[260px] left-[36%] max-md:left-[5%] max-md:size-[460px]!" />
      <Glow size={500} className="left-[70%] top-[200px] max-md:hidden" from="rgba(255,180,35,.22)" via="rgba(255,180,35,.06)" />

      <main className="relative">
        {/* Hero */}
        <section className="grid items-center gap-12 px-5 pb-6 pt-5 md:px-8 md:pb-24 md:pt-16 lg:px-12 xl:grid-cols-[1.05fr_1fr] 2xl:px-16 2xl:pt-[88px]">
          <div className="flex flex-col gap-4 md:gap-7">
            <h1 className="font-display text-[44px] leading-[1.02] tracking-[-.01em] text-pretty md:text-[72px] md:leading-none 2xl:text-[92px]">
              Long night?
              <br />
              <span className="text-gradient font-light italic">Let&apos;s</span> <span className="font-light">talk.</span>
            </h1>
            <p className="max-w-[520px] text-[15px] leading-[1.55] text-ink-2 text-pretty md:text-xl">
              {brand.tagline} <span className="max-md:hidden">In English, Hindi or Hinglish — whatever suits your mood.</span>
            </p>
            <div className="flex flex-col gap-3.5 md:flex-row md:items-center">
              <PrimaryLink href="?auth=signup" scroll={false} size="lg" shimmer className="shadow-glow max-md:h-[54px]">
                Start free
              </PrimaryLink>
              <GlassLink href="/explore" size="lg" className="max-md:h-12">
                <span className="text-marigold">✧</span>Meet the companions
              </GlassLink>
            </div>
            <p className="label-caps text-center text-[11px] text-ink-3 md:text-left md:text-xs md:tracking-[.16em]">
              18+ · AI characters · Free to start
            </p>
          </div>

          {/* Collage (desktop) */}
          <div className="relative hidden h-[620px] origin-top-left scale-[.86] xl:block 2xl:scale-100" aria-hidden>
            {collage.map((p, i) => {
              const c = bySlug[p.slug];
              return (
                <div
                  key={p.slug}
                  className="animate-floaty absolute overflow-hidden rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,.6)]"
                  style={{ width: p.w, height: p.h, left: p.left, top: p.top, animationDuration: p.dur, animationDelay: p.delay, zIndex: i + 1 }}
                >
                  <Portrait companion={c} sizes="230px" priority />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(10,7,9,.92))]" />
                  <div className="absolute bottom-3.5 left-3.5">
                    <div className="font-display text-xl">
                      {c.name}, {c.age}
                    </div>
                    <div className="text-xs text-ink-2">{c.city}</div>
                  </div>
                </div>
              );
            })}
            <div className="absolute -left-[30px] bottom-10 z-10 flex w-[300px] flex-col gap-2.5 rounded-[20px] border border-white/10 bg-elevated/75 p-4 shadow-[0_20px_60px_rgba(0,0,0,.6)] backdrop-blur-[20px]">
              <div className="flex items-center gap-2.5">
                <span className="size-[34px] rounded-full bg-[radial-gradient(circle_at_30%_30%,#FF6A3D,#3B0D22)]" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Meera</div>
                  <div className="text-xs text-ink-3">Example conversation</div>
                </div>
                <AiPill>AI</AiPill>
              </div>
              <div className="rounded-[16px_16px_16px_4px] bg-elevated px-3.5 py-2.5 text-sm leading-normal">
                Chai’s ready ☕ …are you coming over?
              </div>
              <div className="flex gap-[5px] px-2.5 py-1">
                {[0, 0.2, 0.4].map((d) => (
                  <span key={d} className="animate-pulse-soft size-1.5 rounded-full bg-rani" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trending */}
        <section className="flex flex-col gap-3 pb-6 md:gap-5 md:px-8 md:pb-[72px] lg:px-12 2xl:px-16">
          <div className="flex items-baseline justify-between px-5 md:px-0">
            <TrendingHeading />
            <Link href="/explore" className="text-xs font-semibold text-rani md:text-sm">
              <span className="md:hidden">All</span>
              <span className="max-md:hidden">See all →</span>
            </Link>
          </div>
          <div className="flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 xl:grid-cols-4 2xl:grid-cols-6">
            {trending.map((c) => (
              <CharacterCard key={c.slug} companion={c} showTags={false} className="w-[190px] flex-none snap-start md:w-auto" />
            ))}
          </div>
        </section>

        {/* Vibes */}
        <section className="flex flex-col gap-2.5 px-5 pb-6 md:gap-5 md:px-8 lg:px-12 2xl:px-16 md:pb-[72px]">
          <SectionTitle className="max-md:text-[22px]">Pick your vibe</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5 md:gap-3.5 2xl:grid-cols-6">
            {vibes.map((v) => (
              <Link
                key={v.label}
                href={`/explore?vibe=${encodeURIComponent(v.vibe ?? v.label.split(" ")[0])}`}
                className="relative flex h-[90px] items-end overflow-hidden rounded-2xl bg-surface p-2.5 transition-transform hover:-translate-y-1 md:h-[150px] md:rounded-[20px] md:p-4"
                style={{ backgroundImage: `radial-gradient(ellipse at 50% 0%, ${v.tint}, transparent 65%)` }}
              >
                <span className="font-display text-[15px] md:text-xl">
                  <span className="md:hidden">{v.short}</span>
                  <span className="max-md:hidden">{v.label}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="grid gap-8 px-5 pb-10 md:grid-cols-3 md:gap-10 md:px-8 lg:px-12 2xl:px-16 md:pb-[72px]">
          {steps.map(([title, body], i) => (
            <div key={title} className="flex gap-5">
              <span className="text-gradient font-display text-[56px] font-light leading-[.9] md:text-7xl">{i + 1}</span>
              <div className="flex flex-col gap-2 pt-1.5">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm leading-[1.55] text-ink-2">{body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Create your own */}
        <section className="bg-saanjh mx-5 mb-10 rounded-3xl p-px md:mx-8 lg:mx-12 2xl:mx-16 md:mb-[72px]">
          <div className="grid items-center gap-8 rounded-[23px] bg-surface p-6 md:grid-cols-2 md:gap-12 md:px-12 md:py-10">
            <div className="flex flex-col gap-3.5">
              <h2 className="font-display text-[32px] font-light leading-[1.05] md:text-[40px]">
                Create your own <em className="text-rani">companion</em>
              </h2>
              <p className="max-w-[440px] text-[15px] leading-relaxed text-ink-2">
                Face, voice, city, personality. Original characters only — no real people.
              </p>
              <PrimaryLink href="/create" className="self-start">Try the builder →</PrimaryLink>
            </div>
            <div className="grid grid-cols-[110px_1fr] items-center gap-5 md:grid-cols-[140px_1fr]" aria-hidden>
              <div className="h-[146px] rounded-2xl bg-elevated bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,106,61,.5),transparent_60%)] md:h-[186px]" />
              <div className="flex flex-col gap-3.5 text-[13px]">
                {[
                  ["Playful", "Serious", 35],
                  ["Shy", "Bold", 70],
                ].map(([a, b, pct]) => (
                  <div key={a} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-ink-2">
                      <span>{a}</span>
                      <span>{b}</span>
                    </div>
                    <div className="relative h-1 rounded-sm bg-elevated">
                      <div className="h-full rounded-sm bg-gradient-to-r from-rani to-sunset" style={{ width: `${pct}%` }} />
                      <span className="absolute -top-1.5 size-4 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,46,126,.3)]" style={{ left: `${pct}%` }} />
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rani bg-wine px-3 text-xs font-semibold text-rani">▶ Voice: Soft Mumbai</span>
                  <span className="inline-flex h-8 items-center rounded-full bg-elevated px-3 text-xs text-ink-2">Husky Delhi</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing teaser + FAQ */}
        <section className="grid items-start gap-10 px-5 pb-16 md:grid-cols-2 md:gap-16 md:px-8 lg:px-12 2xl:px-16 md:pb-[72px]">
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-[32px] font-light leading-[1.1] md:text-[40px]">
              ₹0 to start. <em className="text-marigold">✦ {brand.creditName}</em> for the rest.
            </h2>
            <p className="max-w-[440px] text-[15px] leading-relaxed text-ink-2">
              Free chat every day. Weekly pass {formatINR(weeklyPass.pricePaise)}. {brand.name} Plus from {formatINR(yearly.perMonthPaise)}/month on the yearly plan, GST included. Cancel in two taps.
            </p>
            <Link href="/pricing" className="text-sm font-semibold text-rani">
              See plans and limits →
            </Link>
          </div>
          <div className="flex flex-col text-[15px]">
            {faqs.map(([q, a], i) => (
              <details key={q} open={i === 1} className="group border-b border-white/[.07] py-[18px]">
                <summary className="flex cursor-pointer list-none justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  <span>{q}</span>
                  <span className="text-ink-3 group-open:text-rani">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-[1.55] text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
