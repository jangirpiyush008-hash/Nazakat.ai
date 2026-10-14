"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { brand } from "@/config/brand";
import { AGE_COOKIE, INTEREST_COOKIE, readCookie, setPrefCookie } from "@/lib/prefs";

const options = [
  { id: "women", label: "Women", glyph: "♀" },
  { id: "men", label: "Men", glyph: "♂" },
  { id: "anime", label: "Anime", glyph: "✧" },
] as const;

/**
 * First-visit 18+ self-declaration plus "interested in". This is a soft gate only.
 * Eligibility is recorded and enforced server-side at sign-up (Milestone 2).
 */
export function AgeGate() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string>("women");
  const router = useRouter();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!readCookie(AGE_COOKIE)) setOpen(true);
  }, []);
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const confirm = () => {
    setPrefCookie(AGE_COOKIE, "1");
    setPrefCookie(INTEREST_COOKIE, choice);
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 p-4 backdrop-blur-xl" role="dialog" aria-modal aria-labelledby="age-title">
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-3xl border border-white/10 bg-surface p-6 text-center shadow-card md:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,46,126,.4),transparent_70%)] blur-2xl" />
        <div className="relative flex flex-col gap-5">
          <div className="font-display text-2xl">
            {brand.name}
            <span className="text-rani">.</span>
          </div>
          <div>
            <h2 id="age-title" className="font-display text-[32px] font-light leading-tight">
              <em className="text-gradient">18+</em> only
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              Companions are AI and fictional. By entering you agree to our{" "}
              <Link href="/legal/terms" className="text-rani">Terms</Link>.
            </p>
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">I’m interested in</legend>
            <div className="grid grid-cols-3 gap-2.5">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setChoice(o.id)}
                  aria-pressed={choice === o.id}
                  className={clsx(
                    "flex flex-col items-center gap-2 rounded-2xl py-4 text-sm transition-colors",
                    choice === o.id ? "bg-wine font-semibold text-rani shadow-[0_0_0_1px_#FF2E7E]" : "bg-elevated text-ink-2 hover:text-ink",
                  )}
                >
                  <span className="text-3xl leading-none" aria-hidden>{o.glyph}</span>
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>
          <button ref={confirmRef} type="button" onClick={confirm} className="bg-saanjh h-[52px] rounded-[14px] text-[15px] font-semibold text-white shadow-glow">
            I’m 18 or older
          </button>
          <a href="https://www.google.com" className="text-sm text-ink-3 hover:text-ink">
            Leave site
          </a>
        </div>
      </div>
    </div>
  );
}
