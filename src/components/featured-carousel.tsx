"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";

export type FeaturedSlide = {
  slug: string;
  name: string;
  age: number;
  quote: string;
  meta: string;
  wash: string;
};

const INTERVAL = 6000;

export function FeaturedCarousel({ slides }: { slides: FeaturedSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = useCallback((d: number) => setI((n) => (n + d + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => go(1), INTERVAL);
    return () => clearInterval(t);
  }, [paused, go, slides.length]);

  if (!slides.length) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured tonight"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative h-[380px] overflow-hidden rounded-3xl"
    >
      {slides.map((s, n) => (
        <div
          key={s.slug}
          role="group"
          aria-roledescription="slide"
          aria-label={`${n + 1} of ${slides.length}`}
          aria-hidden={n !== i}
          className={clsx("absolute inset-0 transition-opacity duration-500", n === i ? "opacity-100" : "pointer-events-none opacity-0")}
        >
          <div className="absolute inset-y-0 right-0 w-full md:w-[60%]" style={{ background: s.wash }}>
            <span className="absolute inset-x-0 top-1/2 text-center font-mono text-[11px] text-ink-3/70">portrait · {s.name}</span>
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(10,7,9,.95)_35%,transparent_80%)] md:bg-[linear-gradient(90deg,rgba(10,7,9,.92)_32%,transparent_68%)]" />
          <div className="absolute inset-x-6 bottom-12 flex max-w-[460px] flex-col gap-3 md:inset-y-0 md:left-12 md:justify-center">
            <span className="self-start rounded-full bg-marigold px-2.5 py-1 text-[11px] font-bold text-on-gold">TONIGHT’S PICK</span>
            <h2 className="font-display text-[40px] font-light leading-none md:text-[56px]">
              {s.name}, {s.age}
            </h2>
            <p className="font-display text-lg italic md:text-[22px]">“{s.quote}”</p>
            <p className="text-[13px] text-ink-2">{s.meta}</p>
            <Link
              href={`/companions/${s.slug}`}
              tabIndex={n === i ? 0 : -1}
              className="bg-saanjh inline-flex h-12 items-center gap-2 self-start rounded-[14px] px-[22px] text-sm font-semibold text-white shadow-glow-sm"
            >
              <MessageCircle className="size-4" aria-hidden /> Chat with {s.name}
            </Link>
          </div>
        </div>
      ))}

      <div className="absolute bottom-4 left-6 flex gap-1.5 md:left-12">
        {slides.map((s, n) => (
          <button
            key={s.slug}
            type="button"
            onClick={() => setI(n)}
            aria-label={`Show ${s.name}`}
            aria-current={n === i}
            className={clsx("h-1.5 rounded-full transition-all", n === i ? "bg-saanjh w-6" : "w-1.5 bg-white/30")}
          />
        ))}
      </div>
      <div className="absolute bottom-3 right-4 flex gap-2">
        <button type="button" onClick={() => go(-1)} aria-label="Previous" className="glass flex size-10 items-center justify-center rounded-full">
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next" className="glass flex size-10 items-center justify-center rounded-full">
          <ChevronRight className="size-5" />
        </button>
      </div>
    </section>
  );
}
