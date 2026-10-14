"use client";

import Image from "next/image";
import { useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Swipeable photo stack: current photo with the next one peeking, arrows, dots. */
export function PhotoCarousel({
  photos,
  alt,
  wash,
  peek = false,
  counter = false,
  sizes = "(max-width: 768px) 90vw, 420px",
  className,
  children,
}: {
  photos: string[];
  alt: string;
  wash: string;
  /** Show a slice of the next photo to the right (quick-view style). */
  peek?: boolean;
  counter?: boolean;
  sizes?: string;
  className?: string;
  /** Overlay content (name, badges) drawn above the photo. */
  children?: React.ReactNode;
}) {
  const [i, setI] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const n = photos.length;
  const go = (d: number) => n > 1 && setI((v) => (v + d + n) % n);

  if (!n) {
    return (
      <div className={clsx("relative overflow-hidden rounded-[20px]", className)} style={{ background: wash }}>
        {children}
      </div>
    );
  }

  return (
    <div className={clsx("relative", className)}>
      <div
        className="relative h-full w-full"
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          setTouchX(null);
        }}
      >
        {peek && n > 1 && (
          <div className="absolute inset-y-[6%] right-0 w-[24%] overflow-hidden rounded-r-[20px] opacity-60" style={{ background: wash }}>
            <Image src={photos[(i + 1) % n]} alt="" fill sizes="160px" className="object-cover object-left" />
          </div>
        )}
        <div className={clsx("absolute inset-y-0 left-0 overflow-hidden rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,.5)]", peek && n > 1 ? "right-[20%]" : "right-0")} style={{ background: wash }}>
          {photos.map((src, k) => (
            <Image
              key={src}
              src={src}
              alt={k === 0 ? alt : `${alt}, photo ${k + 1}`}
              fill
              sizes={sizes}
              priority={k === 0}
              className={clsx("object-cover transition-opacity duration-300", k === i ? "opacity-100" : "opacity-0")}
            />
          ))}
          {children}
          {counter && n > 1 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md">
              {i + 1} / {n}
            </span>
          )}
        </div>
        {n > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" aria-label="Next photo" onClick={() => go(1)} className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60">
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
      {n > 1 && !counter && (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Photos">
          {photos.map((src, k) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`Photo ${k + 1}`}
              onClick={() => setI(k)}
              className={clsx("h-1.5 rounded-full transition-all", k === i ? "w-6 bg-rani" : "w-1.5 bg-white/30")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
