"use client";

import { useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { sparkCosts, type VideoDuration } from "@/config/pricing";

const ideas = {
  image: ["Selfie on a rainy Mumbai balcony", "Candle-lit café, looking at the camera", "Rooftop fairy lights at night", "Getting ready for a wedding, in a saree"],
  video: ["Smiles and waves at the camera", "Walking along Marine Drive at night", "Dancing slowly in the rain", "Sipping chai and laughing"],
};

/** Bottom sheet to describe a photo or video, pick a length, and see the Sparks cost before spending. */
export function MediaSheet({
  kind,
  name,
  balance,
  durations,
  fromPhoto = false,
  onClose,
  onCreate,
}: {
  kind: "image" | "video";
  name: string;
  balance: number;
  durations: VideoDuration[];
  /** Animating a photo the user already has. */
  fromPhoto?: boolean;
  onClose: () => void;
  onCreate: (prompt: string, duration?: VideoDuration) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<VideoDuration>(durations[0] ?? 5);
  const cost = kind === "image" ? sparkCosts.image : sparkCosts.video[duration];
  const short = balance < cost;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div role="dialog" aria-modal aria-labelledby="media-title" onClick={(e) => e.stopPropagation()} className="relative flex w-full max-w-[520px] flex-col gap-4 rounded-t-3xl bg-surface p-6 md:rounded-3xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full hover:bg-elevated">
          <X className="size-5" />
        </button>
        <h2 id="media-title" className="font-display text-[28px] font-light">
          {kind === "image" ? `Ask ${name} for a photo` : fromPhoto ? `Bring this photo to life` : `Ask ${name} for a video`}
        </h2>
        <label htmlFor="media-prompt" className="sr-only">Describe it</label>
        <textarea
          id="media-prompt"
          autoFocus
          rows={3}
          maxLength={500}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={kind === "image" ? "Where is she, what's she wearing, what's the mood?" : "What happens in the clip?"}
          className="resize-none rounded-2xl bg-bg p-4 text-[15px] outline-none placeholder:text-ink-3 focus:shadow-[0_0_0_1px_#FF2E7E,0_0_0_4px_rgba(255,46,126,.2)]"
        />
        <div className="flex flex-wrap gap-2">
          {ideas[kind].map((i) => (
            <button key={i} type="button" onClick={() => setPrompt(i)} className="rounded-full bg-elevated px-3 py-1.5 text-xs text-ink-2 hover:text-ink">
              {i}
            </button>
          ))}
        </div>

        {kind === "video" && (
          <div className="flex flex-col gap-2">
            <span className="label-caps text-ink-3">Length</span>
            <div className="grid grid-cols-4 gap-2">
              {durations.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={duration === d}
                  onClick={() => setDuration(d)}
                  className={clsx("flex flex-col items-center rounded-2xl py-2.5", duration === d ? "border border-rani bg-wine text-rani" : "bg-elevated text-ink-2")}
                >
                  <span className="text-[15px] font-semibold">{d}s</span>
                  <span className="text-[11px] font-bold text-marigold">✦ {sparkCosts.video[d]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-ink-3">
          AI-generated and private to you. Flirty is fine; nudity, minors and real people are blocked, and blocked or failed requests are refunded.
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink-2">
            Balance <b className="text-marigold">✦ {balance}</b>
          </span>
          {short ? (
            <a href="/pricing" className="bg-saanjh inline-flex h-12 items-center rounded-[14px] px-5 text-sm font-semibold text-white">
              Get Sparks
            </a>
          ) : (
            <button
              type="button"
              disabled={prompt.trim().length < 2}
              onClick={() => onCreate(prompt.trim(), kind === "video" ? duration : undefined)}
              className="bg-saanjh inline-flex h-12 items-center gap-2 rounded-[14px] px-5 text-sm font-semibold text-white shadow-glow-sm disabled:opacity-40"
            >
              Create · ✦ {cost}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
