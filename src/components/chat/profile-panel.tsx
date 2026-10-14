"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { Camera, ChevronDown, Clapperboard, Images, Phone } from "lucide-react";
import { PhotoCarousel } from "@/components/photo-carousel";
import type { MediaRef } from "./chat-workspace";

export type PanelCompanion = {
  slug: string;
  name: string;
  age: number;
  city: string;
  occupation: string;
  wash: string;
  bio?: string;
  traits?: string[];
  interests?: string[];
  modelId?: string;
  photos: string[];
};

/** Right-hand character panel in chat: photos, recent media, quick actions, about + memory. */
export function ProfilePanel({
  companion: c,
  media,
  conversationId,
  features,
  onPhoto,
  onVideo,
  memory,
}: {
  companion: PanelCompanion;
  media: MediaRef[];
  conversationId: string;
  features: { image: boolean; video: boolean; voice: boolean };
  onPhoto: () => void;
  onVideo: () => void;
  memory: React.ReactNode;
}) {
  const [open, setOpen] = useState<"about" | "memory" | null>("about");
  const recent = media.filter((m) => m.kind === "image" && m.url).slice(-8).reverse();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <PhotoCarousel photos={c.photos} alt={`${c.name}, AI character`} wash={c.wash} counter className="aspect-[4/5] w-full flex-none [&>div>div]:rounded-none" sizes="340px">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(transparent,rgba(10,7,9,.9))] px-4 pb-3 pt-12">
          <Link href={`/companions/${c.slug}`} className="pointer-events-auto font-display text-2xl hover:underline">
            {c.name} <span className="font-light text-ink-2">· {c.age}</span>
          </Link>
          <div className="text-xs text-ink-2">{c.occupation} · {c.city}</div>
        </div>
      </PhotoCarousel>

      {recent.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pt-4">
          <div className="text-[13px] font-semibold">Recent photos</div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Link href="/app/gallery" className="flex size-16 flex-none flex-col items-center justify-center gap-0.5 rounded-xl bg-elevated text-[10px] font-semibold text-ink-2 hover:text-ink">
              <Images className="size-4" /> Gallery
            </Link>
            {recent.map((m) => (
              <a key={m.id} href={m.url!} target="_blank" rel="noreferrer" className="size-16 flex-none overflow-hidden rounded-xl bg-elevated">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                <img src={m.url!} alt="" className="size-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 px-4 pt-4">
        {features.voice && (
          <Link href={`/app/call/${conversationId}`} aria-label={`Call ${c.name}`} className="flex size-11 items-center justify-center rounded-full bg-[#1DB954]/15 text-[#1DB954] hover:bg-[#1DB954]/25">
            <Phone className="size-[18px]" />
          </Link>
        )}
        {features.image && (
          <button type="button" onClick={onPhoto} aria-label={`Ask ${c.name} for a photo`} className="flex size-11 items-center justify-center rounded-full bg-elevated text-marigold hover:bg-white/10">
            <Camera className="size-[18px]" />
          </button>
        )}
        {features.video && (
          <button type="button" onClick={onVideo} aria-label={`Ask ${c.name} for a video`} className="flex size-11 items-center justify-center rounded-full bg-elevated text-marigold hover:bg-white/10">
            <Clapperboard className="size-[18px]" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-col">
        <Section title="About" open={open === "about"} onToggle={() => setOpen(open === "about" ? null : "about")}>
          {c.bio && <p className="text-[13px] leading-relaxed text-ink-2">{c.bio}</p>}
          {!!(c.traits?.length || c.interests?.length) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...(c.traits ?? []), ...(c.interests ?? [])].map((t) => (
                <span key={t} className="rounded-full bg-elevated px-2.5 py-1 text-[11px]">{t}</span>
              ))}
            </div>
          )}
          {c.modelId && <p className="mt-3 text-[11px] text-ink-3">Model ID {c.modelId} · AI character</p>}
        </Section>
        <Section title="Memory" open={open === "memory"} onToggle={() => setOpen(open === "memory" ? null : "memory")}>
          <div className="-mx-4 -mb-4">{memory}</div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/[.06]">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3.5 text-sm font-semibold hover:bg-white/[.03]">
        {title}
        <ChevronDown className={clsx("size-4 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
