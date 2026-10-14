import type { ReactNode } from "react";
import { Glow } from "./ui";

export function SimplePage({ title, intro, children }: { title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <Glow size={600} className="-top-[300px] left-[40%]" />
      <main className="relative mx-auto flex max-w-[760px] flex-col gap-6 px-5 py-14 md:py-20">
        <h1 className="font-display text-[40px] font-light leading-[1.05] md:text-[56px]">{title}</h1>
        {intro && <p className="text-[15px] leading-relaxed text-ink-2">{intro}</p>}
        {children}
      </main>
    </div>
  );
}
