"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Camera, MessageCircle, Phone, Share2, X } from "lucide-react";
import type { Companion } from "@/lib/companions";
import { languageLabels } from "@/lib/companions";
import { PhotoCarousel, photosOf } from "./photo-carousel";

const QuickView = createContext<((c: Companion) => void) | null>(null);
/** Returns an opener when a QuickViewProvider is mounted, else null (cards then just link). */
export const useQuickView = () => useContext(QuickView);

export function QuickViewProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<Companion | null>(null);
  const show = useCallback((c: Companion) => setOpen(c), []);
  return (
    <QuickView.Provider value={show}>
      {children}
      {open && <CompanionQuickView companion={open} onClose={() => setOpen(null)} />}
    </QuickView.Provider>
  );
}

function CompanionQuickView({ companion: c, onClose }: { companion: Companion; onClose: () => void }) {
  const [more, setMore] = useState(false);
  const [shared, setShared] = useState(false);
  const chat = `/app/chat/new?c=${c.slug}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const share = async () => {
    const url = `${location.origin}/companions/${c.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: c.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-md md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={`${c.name}, ${c.age}`}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[94dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] border border-white/[.08] bg-surface md:rounded-[28px]"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70">
          <X className="size-5" />
        </button>

        <div className="overflow-y-auto px-5 pb-4 pt-5 md:px-7 md:pt-7">
          <PhotoCarousel photos={photosOf(c)} alt={`${c.name}, AI character`} wash={c.wash} peek className="mx-auto aspect-[4/4.2] w-full" sizes="(max-width: 768px) 80vw, 420px" />

          <div className="mt-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[30px] leading-tight">
                {c.name} <span className="font-light text-ink-2">{c.age}</span>
              </h2>
              <p className="text-[13px] text-ink-2">
                {c.occupation} · {c.city}
              </p>
            </div>
            <button type="button" onClick={share} className="inline-flex h-9 flex-none items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-[13px] font-semibold hover:bg-white/5">
              <Share2 className="size-4" /> {shared ? "Link copied" : "Share"}
            </button>
          </div>

          <p className={`mt-3 text-[15px] leading-relaxed text-ink-2 ${more ? "" : "line-clamp-2"}`}>
            <span className="font-display italic text-ink">“{c.hook}”</span> {c.bio}
          </p>
          <button type="button" onClick={() => setMore((v) => !v)} className="mt-1 text-[13px] font-semibold text-rani">
            {more ? "Show less" : "Show more"}
          </button>

          <div className="mt-4 border-t border-white/[.06] pt-4">
            <div className="label-caps mb-2 text-[11px] text-ink-3">Personality</div>
            <div className="flex flex-wrap gap-1.5">
              {[...c.traits, ...c.interests].map((t) => (
                <span key={t} className="rounded-full bg-elevated px-3 py-1.5 text-xs">{t}</span>
              ))}
              {c.languages.map((l) => (
                <span key={l} className="rounded-full bg-wine px-3 py-1.5 text-xs font-semibold text-rani">{languageLabels[l].label}</span>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-ink-3">
              Model ID {c.modelId} · Original AI character, not a real person ·{" "}
              <Link href={`/companions/${c.slug}`} className="underline hover:text-ink">Full profile</Link>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-white/[.06] bg-surface p-3 md:p-4">
          <Link href={chat} className="bg-saanjh inline-flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold text-white">
            <MessageCircle className="size-[18px]" /> Chat
          </Link>
          <Link href={`${chat}&then=photo`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-elevated text-sm font-semibold hover:bg-white/10">
            <Camera className="size-[18px] text-marigold" /> Photo
          </Link>
          <Link href={`${chat}&then=call`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1DB954]/90 text-sm font-semibold text-white hover:bg-[#1DB954]">
            <Phone className="size-[18px]" /> Call
          </Link>
        </div>
      </div>
    </div>
  );
}
