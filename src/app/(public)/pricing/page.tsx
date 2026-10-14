import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { brand } from "@/config/brand";
import { getCapabilities } from "@/config/features";
import { formatINR, plusFeatures, plusOffer, sparkCosts, sparkPacks, weeklyPass, type Period } from "@/config/pricing";
import { DisabledButton, Glow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Plans & Sparks",
  description: `${brand.name} pricing in INR: free daily chat, a ₹49 weekly pass, Plus from ₹299/month, and ${brand.creditName} packs. No hidden charges.`,
  alternates: { canonical: "/pricing" },
};

const periods: Period[] = ["yearly", "quarterly", "monthly"];

const beforePay = [
  "Price incl. GST, and the billing interval",
  "Whether it auto-renews, and when",
  "How to cancel — two taps, from Settings",
  "Refund rules for failed generations and payments",
  `The ${brand.creditName} cost before every paid action`,
];

const faqs = [
  ["Can I chat for free?", "Yes. Every account gets a free daily message allowance with every public companion. No card needed."],
  ["Can I pay with UPI?", "UPI will be the first payment option, alongside cards, once our payment partner approves us. Until then checkout stays switched off."],
  ["How do I cancel?", "Settings → Subscription → Cancel. Plus stays active until the end of the period you paid for. The weekly pass never renews."],
  [`What are ${brand.creditName}?`, `${brand.creditName} (✦) pay for extras: a photo costs ✦ ${sparkCosts.image}, a 5-second video ✦ ${sparkCosts.video[5]}, and voice calls ✦ ${sparkCosts.voicePerMinute}/min. You always see the cost first, and failed generations are refunded.`],
];

type SP = Promise<{ period?: string }>;

export default async function PricingPage({ searchParams }: { searchParams: SP }) {
  const { period: raw } = await searchParams;
  const period: Period = periods.includes(raw as Period) ? (raw as Period) : "yearly";
  const offer = plusOffer(period);
  const { payments } = getCapabilities();

  return (
    <div className="relative overflow-hidden">
      <Glow size={700} className="-top-[300px] left-[30%]" />
      <main className="relative mx-auto flex max-w-[1080px] flex-col gap-10 px-5 py-12 md:px-8 md:py-16">
        <header className="flex flex-col gap-4 text-center">
          <h1 className="font-display text-[40px] font-light leading-[1.05] md:text-[56px]">
            Simple plans, <em className="text-gradient">no</em> hidden charges.
          </h1>
          <p className="mx-auto max-w-[560px] text-[15px] leading-relaxed text-ink-2">Free chat every day. Upgrade only when you want more. INR prices, GST included.</p>
          {!payments && (
            <p className="mx-auto rounded-full bg-elevated px-4 py-2 text-xs text-ink-2">
              Draft pricing · checkout opens once our payment partner approves {brand.name}.
            </p>
          )}
        </header>

        {/* Period switch */}
        <div className="mx-auto flex gap-1 rounded-full bg-surface p-1" role="tablist" aria-label="Billing period">
          {periods.map((p) => {
            const o = plusOffer(p);
            return (
              <Link
                key={p}
                href={`/pricing?period=${p}`}
                scroll={false}
                role="tab"
                aria-selected={p === period}
                className={clsx("flex h-10 items-center gap-2 rounded-full px-4 text-[13px]", p === period ? "bg-wine font-semibold text-rani" : "text-ink-2 hover:text-ink")}
              >
                {o.label}
                {o.savingPct > 0 && <span className="rounded-full bg-marigold px-1.5 py-0.5 text-[10px] font-bold text-on-gold">−{o.savingPct}%</span>}
              </Link>
            );
          })}
        </div>

        <div className="grid items-stretch gap-4 md:grid-cols-[1fr_1.3fr_1fr]">
          {/* Free */}
          <article className="flex flex-col gap-4 rounded-[20px] bg-surface p-6">
            <h2 className="text-sm font-semibold text-ink-2">Free</h2>
            <div className="font-display text-4xl font-light">₹0</div>
            <ul className="flex flex-col gap-2 text-[13px]">
              {["Daily free messages", "All public companions", "Memory you control"].map((f) => (
                <li key={f} className="flex gap-2"><span className="text-marigold">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="?auth=signup" scroll={false} className="glass mt-auto inline-flex h-12 items-center justify-center rounded-[14px] text-sm font-semibold">
              Start free
            </Link>
          </article>

          {/* Plus */}
          <article className="relative flex flex-col gap-4 rounded-[20px] bg-elevated p-6 shadow-[0_0_0_1px_#FF2E7E,0_20px_60px_rgba(255,46,126,.25)] md:-my-3 md:py-9">
            <span className="absolute -top-3 left-6 rounded-full bg-marigold px-2.5 py-1 text-[11px] font-bold text-on-gold">MOST CHOSEN</span>
            <h2 className="text-sm font-semibold text-ink-2">{brand.name} Plus · {offer.label}</h2>
            <div>
              <div className="font-display text-5xl font-light">
                {formatINR(offer.perMonthPaise)}
                <span className="text-sm text-ink-3">/month</span>
              </div>
              <p className="mt-1 text-xs text-ink-2">
                {period === "monthly"
                  ? "Billed monthly · auto-renews until cancelled"
                  : `${formatINR(offer.pricePaise)} billed every ${offer.months} months · save ${offer.savingPct}% vs monthly`}
              </p>
            </div>
            <ul className="flex flex-col gap-2 text-[13px]">
              {plusFeatures.map((f) => (
                <li key={f} className="flex gap-2"><span className="text-marigold">✓</span>{f}</li>
              ))}
            </ul>
            <DisabledButton className="mt-auto">Checkout not yet enabled</DisabledButton>
          </article>

          {/* Weekly pass */}
          <article className="flex flex-col gap-4 rounded-[20px] bg-surface p-6">
            <h2 className="text-sm font-semibold text-ink-2">{weeklyPass.name}</h2>
            <div className="font-display text-4xl font-light">
              {formatINR(weeklyPass.pricePaise)}
              <span className="text-sm text-ink-3">/week</span>
            </div>
            <ul className="flex flex-col gap-2 text-[13px]">
              {weeklyPass.features.map((f) => (
                <li key={f} className="flex gap-2"><span className="text-marigold">✓</span>{f}</li>
              ))}
            </ul>
            <DisabledButton className="mt-auto">Checkout not yet enabled</DisabledButton>
          </article>
        </div>

        {/* Sparks packs */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-[28px] font-light">
            <span className="text-marigold">✦</span> {brand.creditName} packs
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {sparkPacks.map((p) => (
              <div key={p.sparks} className={clsx("flex flex-col gap-1 rounded-[20px] bg-surface p-5", p.popular && "shadow-[0_0_0_1px_rgba(255,180,35,.6)]")}>
                <span className="text-2xl font-bold text-marigold">✦ {p.sparks.toLocaleString("en-IN")}</span>
                <span className="text-sm text-ink-2">{formatINR(p.pricePaise)} · one-time</span>
                {p.popular && <span className="text-[11px] font-semibold text-marigold">Best value</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-3">
            Photo ✦ {sparkCosts.image} · Video ✦ {sparkCosts.video[5]} (5s) / {sparkCosts.video[8]} (8s) / {sparkCosts.video[10]} (10s) / {sparkCosts.video[15]} (15s) · Voice call ✦ {sparkCosts.voicePerMinute}/min. Failed generations are refunded automatically.
          </p>
        </section>

        <section className="grid gap-8 rounded-[20px] bg-surface p-6 md:grid-cols-2 md:p-10">
          <h2 className="font-display text-[28px] font-light leading-tight">Before you pay, you always see…</h2>
          <ul className="flex flex-col gap-3 text-sm text-ink-2">
            {beforePay.map((b) => (
              <li key={b} className="flex gap-2.5"><span className="text-marigold">✦</span>{b}</li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col">
          {faqs.map(([q, a]) => (
            <details key={q} className="group border-b border-white/[.07] py-[18px] text-[15px]">
              <summary className="flex cursor-pointer list-none justify-between gap-4 [&::-webkit-details-marker]:hidden">
                {q}
                <span className="text-ink-3 group-open:rotate-45 group-open:text-rani">+</span>
              </summary>
              <p className="mt-2 text-sm leading-[1.55] text-ink-2">{a}</p>
            </details>
          ))}
        </section>

        <p className="text-center text-xs text-ink-3">
          See <Link href="/legal/refunds-and-cancellation" className="text-rani">Refunds &amp; cancellation</Link> and{" "}
          <Link href="/legal/credits" className="text-rani">{brand.creditName} &amp; credits</Link>.
        </p>
      </main>
    </div>
  );
}
