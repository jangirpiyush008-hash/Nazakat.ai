"use client";

import { useEffect, useState } from "react";

/**
 * Discreet mode: neutral tab title, and the screen blurs the moment the tab or
 * window loses focus (shared phones, someone looking over your shoulder).
 */
export function DiscreetGuard({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const original = document.title;
    document.title = "Notes";
    const hide = () => setHidden(true);
    const onVis = () => document.visibilityState === "hidden" && hide();
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.title = original;
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled]);

  return (
    <>
      <div className={hidden ? "pointer-events-none blur-2xl" : undefined} aria-hidden={hidden || undefined}>
        {children}
      </div>
      {hidden && (
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-bg/90 text-sm text-ink-2"
        >
          Tap to continue
        </button>
      )}
    </>
  );
}
