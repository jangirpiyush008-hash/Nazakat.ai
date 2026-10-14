import Link from "next/link";
import { Suspense } from "react";
import clsx from "clsx";
import { brand, disclosureLines } from "@/config/brand";
import { GenderToggle, GenderToggleFallback } from "./shell/gender-toggle";
import { HeaderAuth } from "./shell/header-auth";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={clsx("font-display text-2xl tracking-[.01em] text-ink md:text-[26px]", className)} aria-label={`${brand.name} home`}>
      {brand.name}
      <span className="text-rani">.</span>
    </Link>
  );
}

/** Header: logo, category toggle, auth buttons. Primary nav lives in the sidebar (lg) and bottom tabs (mobile). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[.07] bg-bg/70 backdrop-blur-[20px]">
      <div className="flex items-center justify-between gap-4 px-5 py-3 md:px-8 md:py-[18px]">
        <Logo />
        <Suspense fallback={<GenderToggleFallback />}>
          <GenderToggle />
        </Suspense>
        <nav aria-label="Primary" className="hidden gap-7 text-sm text-ink-2 md:flex lg:hidden">
          <Link href="/explore" className="hover:text-ink">Explore</Link>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
        </nav>
        <HeaderAuth />
      </div>
    </header>
  );
}

const footerCols: { title: string; links: [string, string][] }[] = [
  {
    title: "Product",
    links: [["Explore", "/explore"], ["Pricing", "/pricing"], ["How it works", "/how-it-works"], ["Help centre", "/help"], ["Contact", "/contact"]],
  },
  {
    title: "Trust",
    links: [
      ["AI companion disclosure", "/legal/ai-disclosure"],
      ["Community guidelines", "/legal/community-guidelines"],
      ["Content safety", "/legal/content-safety"],
      ["Generation policy", "/legal/generation-policy"],
      ["Child safety", "/legal/child-safety"],
      ["AI media labelling", "/legal/ai-media-labelling"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms", "/legal/terms"],
      ["Privacy", "/legal/privacy"],
      ["Cookies", "/legal/cookies"],
      ["Refunds & cancellation", "/legal/refunds-and-cancellation"],
      ["Sparks & credits", "/legal/credits"],
      ["Grievance redressal", "/legal/grievance-redressal"],
      ["Data retention & deletion", "/legal/data-retention-and-deletion"],
      ["Security", "/legal/security"],
      ["Accessibility", "/legal/accessibility"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative bg-surface pb-20 md:pb-0">
      <div className="grid gap-8 px-5 py-8 text-[13px] text-ink-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8 md:pb-12 lg:px-16 md:pt-10">
        <div className="flex flex-col gap-3">
          <span className="font-display text-[22px] text-ink">
            {brand.name}
            <span className="text-rani">.</span>
          </span>
          <p className="text-[11px] font-semibold uppercase leading-[1.8] tracking-[.14em] text-ink-3">
            {disclosureLines.map((l) => (
              <span key={l} className="block">{l}</span>
            ))}
          </p>
        </div>
        {footerCols.map((col) => (
          <div key={col.title} className="flex flex-col gap-2">
            <b className="text-ink">{col.title}</b>
            {col.links.map(([label, href]) => (
              <Link key={href} href={href} className="text-ink-2 hover:text-ink">
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </footer>
  );
}
