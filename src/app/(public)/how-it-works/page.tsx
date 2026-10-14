import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { SimplePage } from "@/components/simple-page";
import { PrimaryLink } from "@/components/ui";

export const metadata: Metadata = { title: "How it works", alternates: { canonical: "/how-it-works" } };

const items = [
  ["Pick a companion", "Every companion is an original, fictional adult character written by our team. None are real people, and none will pretend to be."],
  ["Talk your way", "Chat in Hinglish, Hindi or English. Voice and images arrive only once they are safe, reviewed and clearly priced."],
  ["Own the memory", `${brand.name} remembers short facts you share — never whole conversations. See, edit or delete any memory, any time, or turn memory off.`],
  ["Pay only if you want", `Text chat has a free daily allowance. ${brand.creditName} (✦) cover extras, and the cost is always shown before you spend.`],
];

export default function HowItWorksPage() {
  return (
    <SimplePage title={<>How <em className="text-gradient">{brand.name}</em> works</>}>
      <ol className="flex flex-col gap-6">
        {items.map(([t, b], i) => (
          <li key={t} className="flex gap-5">
            <span className="text-gradient font-display text-5xl font-light leading-none">{i + 1}</span>
            <div><h2 className="text-lg font-semibold">{t}</h2><p className="mt-1 text-sm leading-relaxed text-ink-2">{b}</p></div>
          </li>
        ))}
      </ol>
      <section id="create" className="rounded-[20px] bg-surface p-6">
        <h2 className="font-display text-2xl font-light">Create your own companion</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">Face, voice, city and personality — original characters only, no real people. Coming with {brand.name} Plus.</p>
      </section>
      <PrimaryLink href="/explore" className="self-start">Meet your companion</PrimaryLink>
    </SimplePage>
  );
}
