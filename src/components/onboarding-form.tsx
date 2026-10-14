"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { chatLanguages, type ChatLanguage } from "@/config/languages";
import { createClient } from "@/lib/supabase/browser";

type Interest = "women" | "men" | "anime";
type Lang = ChatLanguage;

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={clsx("relative h-7 w-12 flex-none rounded-full transition-colors", on ? "bg-saanjh" : "bg-elevated")}
    >
      <span className={clsx("absolute top-1 size-5 rounded-full bg-white transition-all", on ? "left-6" : "left-1")} />
    </button>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={clsx("inline-flex h-10 items-center rounded-full px-4 text-[13px]", on ? "border border-rani bg-wine font-semibold text-rani" : "bg-elevated text-ink-2")}>
      {children}
    </button>
  );
}

export function OnboardingForm({ next, consentVersion, defaultInterest }: { next: string; consentVersion: string; defaultInterest: Interest }) {
  const router = useRouter();
  const [adult, setAdult] = useState(false);
  const [aiAck, setAiAck] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [interest, setInterest] = useState<Interest>(defaultInterest);
  const [lang, setLang] = useState<Lang>("hinglish");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("complete_onboarding", {
      consent_version: consentVersion,
      analytics,
      marketing,
      interest,
      chat_language: lang,
    });
    setBusy(false);
    if (error) return setError("Couldn't save that. Please try again.");
    router.replace(next);
    router.refresh();
  };

  const required = [
    { on: adult, set: setAdult, title: "I'm 18 or older", body: "Nazakat is for adults only." },
    { on: aiAck, set: setAiAck, title: "I understand companions are AI", body: "They're fictional characters, not real people, and not therapy or emergency support." },
  ];

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-7 px-5 py-10">
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={clsx("h-1 flex-1 rounded-full", i === 0 ? "bg-saanjh" : "bg-elevated")} />
        ))}
      </div>
      <header>
        <h1 className="font-display text-[40px] font-light leading-tight">Before you start</h1>
        <p className="mt-2 text-sm text-ink-2">Two quick confirmations and a few choices. You can change the choices any time in Settings.</p>
      </header>

      <section className="flex flex-col gap-3">
        {required.map((r) => (
          <button
            key={r.title}
            type="button"
            role="checkbox"
            aria-checked={r.on}
            onClick={() => r.set(!r.on)}
            className={clsx("glass flex items-start gap-3.5 rounded-2xl p-4 text-left", r.on && "shadow-[0_0_0_1px_rgba(255,180,35,.6)]")}
          >
            <span className={clsx("mt-0.5 flex size-6 flex-none items-center justify-center rounded-full", r.on ? "bg-marigold text-on-gold" : "border border-white/20")}>
              {r.on && <Check className="size-4" />}
            </span>
            <span>
              <span className="block text-[15px] font-semibold">{r.title}</span>
              <span className="mt-0.5 block text-[13px] text-ink-2">{r.body}</span>
            </span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-caps text-ink-3">Your choices</h2>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4">
          <div><div className="text-sm font-semibold">Essential</div><div className="text-xs text-ink-3">Account, chat and safety. Always on.</div></div>
          <span className="text-xs text-ink-3">Always on</span>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4">
          <div><div className="text-sm font-semibold">Product analytics</div><div className="text-xs text-ink-3">Anonymous usage to improve the app. Never message content.</div></div>
          <Toggle on={analytics} onChange={setAnalytics} label="Product analytics" />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4">
          <div><div className="text-sm font-semibold">Offers &amp; updates</div><div className="text-xs text-ink-3">Occasional emails about new companions and offers.</div></div>
          <Toggle on={marketing} onChange={setMarketing} label="Offers and updates" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-caps text-ink-3">I&apos;m interested in</h2>
        <div className="flex gap-2">
          {(["women", "men", "anime"] as const).map((g) => (
            <Pill key={g} on={interest === g} onClick={() => setInterest(g)}>{g[0].toUpperCase() + g.slice(1)}</Pill>
          ))}
        </div>
        <h2 className="label-caps mt-2 text-ink-3">Companions reply in</h2>
        <div className="flex flex-wrap gap-2">
          {chatLanguages.map((l) => (
            <Pill key={l.id} on={lang === l.id} onClick={() => setLang(l.id)}>
              {l.label}
            </Pill>
          ))}
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl bg-sindoor/10 px-3 py-2 text-[13px] text-[#FF8DA6]">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={!adult || !aiAck || busy}
        className="bg-saanjh h-[54px] rounded-[14px] text-[15px] font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:bg-none disabled:bg-elevated disabled:text-ink-3 disabled:shadow-none"
      >
        {busy ? "Saving…" : "Continue"}
      </button>
      <p className="text-center text-xs text-ink-3">
        Read the <Link href="/legal/privacy" className="underline">Privacy Policy</Link> and <Link href="/legal/terms" className="underline">Terms</Link>. Drafts pending counsel review.
      </p>
    </main>
  );
}
