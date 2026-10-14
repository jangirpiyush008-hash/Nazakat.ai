"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export type GalleryItem = { id: string; kind: "image" | "video"; url: string | null; duration: number | null; prompt: string; companion: string };

export function GalleryGrid({ initial }: { initial: GalleryItem[] }) {
  const [items, setItems] = useState(initial);
  const [confirm, setConfirm] = useState<string | null>(null);

  const remove = async (id: string) => {
    const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
    if (res.ok) setItems((x) => x.filter((i) => i.id !== id));
    setConfirm(null);
  };

  if (!items.length) {
    return (
      <div className="rounded-[20px] bg-surface p-8 text-center text-sm text-ink-2">
        Nothing here yet. In any chat, tap the camera or clapper icon to ask for a photo or video.{" "}
        <Link href="/app/chat" className="text-rani">Open chats</Link>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {items.map((m) => (
        <figure key={m.id} className="group relative overflow-hidden rounded-[20px] bg-surface">
          {m.url ? (
            m.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
              <img src={m.url} alt={`AI-generated photo of ${m.companion}`} className="aspect-[3/4] w-full object-cover" />
            ) : (
              <video src={m.url} controls playsInline className="aspect-[9/16] w-full bg-black object-cover" />
            )
          ) : (
            <div className="aspect-[3/4] p-4 text-xs text-ink-3">Unavailable</div>
          )}
          <figcaption className="flex items-center justify-between gap-2 p-3 text-xs text-ink-2">
            <span className="min-w-0 truncate">
              {m.companion}
              {m.kind === "video" && ` · ${m.duration}s`} · AI-generated
            </span>
            {confirm === m.id ? (
              <button type="button" onClick={() => remove(m.id)} className="flex-none font-semibold text-sindoor">Delete?</button>
            ) : (
              <button type="button" onClick={() => setConfirm(m.id)} aria-label="Delete" className="flex-none text-ink-3 hover:text-sindoor">
                <Trash2 className="size-4" />
              </button>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
