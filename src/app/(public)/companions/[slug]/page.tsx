import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brand } from "@/config/brand";
import { getCapabilities } from "@/config/features";
import { sparkCosts } from "@/config/pricing";
import { companions, getCompanion, languageLabels } from "@/lib/companions";
import { Portrait } from "@/components/character-card";
import { PrimaryLink } from "@/components/ui";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return companions.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const c = getCompanion((await params).slug);
  if (!c) return {};
  return {
    title: `${c.name}, ${c.age} · ${c.city}`,
    description: `${c.name} is an original fictional AI character — ${c.occupation.toLowerCase()} from ${c.city}. ${c.hook}`,
    alternates: { canonical: `/companions/${c.slug}` },
  };
}

export default async function CompanionPage({ params }: { params: Params }) {
  const c = getCompanion((await params).slug);
  if (!c) notFound();
  const caps = getCapabilities();
  const pronoun = c.gender === "men" ? "He" : "She";

  const modalities = [
    { label: "Text chat", value: "Free · daily limit", tone: "ink-2", on: true },
    { label: "Photos", value: caps.image === "available" ? `✦ ${sparkCosts.image} each` : "Coming soon", tone: "gold", on: caps.image === "available" },
    { label: "Voice call", value: caps.voice === "available" ? `✦ ${sparkCosts.voicePerMinute} / min` : "Coming soon", tone: "gold", on: caps.voice === "available" },
    { label: "Videos (5–15s)", value: caps.video === "available" ? `from ✦ ${sparkCosts.video[5]}` : "Coming soon", tone: "gold", on: caps.video === "available" },
  ];

  return (
    <>
      <main className="mx-auto grid max-w-[1200px] md:grid-cols-[minmax(0,480px)_1fr] md:gap-12 md:px-16 md:py-12">
        {/* Hero */}
        <section className="relative h-[520px] overflow-hidden md:sticky md:top-28 md:h-[640px] md:rounded-3xl">
          <Portrait companion={c} sizes="(max-width: 768px) 100vw, 480px" priority />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,7,9,.4),transparent_25%,transparent_55%,#0A0709_100%)]" />
          <Link
            href="/explore"
            aria-label="Back to explore"
            className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md md:hidden"
          >
            ←
          </Link>
          <div className="absolute inset-x-5 bottom-0 flex flex-col gap-2 pb-2 md:bottom-6 md:left-6">
            <span className="inline-flex h-6 items-center self-start rounded-full bg-white/10 px-2.5 text-[11px] font-semibold backdrop-blur-md">
              AI character · fictional
            </span>
            <h1 className="font-display text-5xl font-light leading-none">{c.name}</h1>
            <p className="text-[13px] text-ink-2">
              {c.age} · {c.occupation} · {c.city}
            </p>
          </div>
        </section>

        {/* Details */}
        <section className="flex flex-col gap-[18px] px-5 pb-32 pt-4 md:px-0 md:pb-0 md:pt-0">
          <p className="font-display text-lg italic leading-normal md:text-2xl">“{c.bio}”</p>

          <div className="flex flex-wrap gap-1.5">
            {c.traits.map((t) => (
              <span key={t} className="inline-flex h-8 items-center rounded-full bg-elevated px-3 text-xs">{t}</span>
            ))}
            {c.languages.map((l, i) => (
              <span
                key={l}
                className={
                  i === 0
                    ? "inline-flex h-8 items-center rounded-full bg-wine px-3 text-xs font-semibold text-rani"
                    : "inline-flex h-8 items-center rounded-full bg-elevated px-3 text-xs"
                }
              >
                {languageLabels[l].label}
              </span>
            ))}
          </div>

          <p className="text-[13px] text-ink-2">Chats in English, Hindi or Hinglish.</p>

          <div className="flex flex-col gap-1.5">
            <h2 className="label-caps mb-1 text-ink-3">What you can do</h2>
            {modalities.map((m) => (
              <div key={m.label} className={`flex justify-between rounded-[14px] bg-surface px-3.5 py-3 text-sm ${m.on ? "" : "text-ink-3"}`}>
                <span>{m.label}</span>
                <span className={`text-xs ${m.on && m.tone === "gold" ? "font-bold text-marigold" : m.on ? "text-ink-2" : ""}`}>{m.value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-surface p-4 text-[13px] leading-relaxed text-ink-2">
            <div className="label-caps mb-1.5 text-[11px] font-bold text-marigold">Boundaries</div>
            {c.name} is an AI character written by {brand.name}. {pronoun} won&apos;t claim to be human, give medical advice, or role-play anyone
            under 18.{" "}
            <Link href="/legal/content-safety" className="text-rani">
              Content safety
            </Link>
          </div>

          <div className="flex justify-center gap-5 text-[13px] text-ink-3 md:justify-start">
            <Link href={`/contact?topic=report&companion=${c.slug}`} className="hover:text-ink">
              Report character
            </Link>
            <Link href="/legal/ai-disclosure" className="hover:text-ink">
              AI disclosure
            </Link>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 bg-[linear-gradient(transparent,#0A0709_40%)] px-4 pb-6 pt-3 md:static md:bg-none md:p-0">
            <PrimaryLink href={`/app/chat/new?c=${c.slug}`} shimmer className="h-[54px] w-full shadow-glow md:w-auto md:px-10">
              Start chatting with {c.name} 💬
            </PrimaryLink>
          </div>
        </section>
      </main>
    </>
  );
}
