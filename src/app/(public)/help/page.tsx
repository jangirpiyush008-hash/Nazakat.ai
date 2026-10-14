import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { legalPages } from "@/lib/legal";
import { SimplePage } from "@/components/simple-page";

export const metadata: Metadata = { title: "Help centre", alternates: { canonical: "/help" } };

const topics = [
  ["Account & sign-in", "Phone OTP, email sign-in, recovering access."],
  ["Memory & privacy", `What ${brand.name} remembers and how to edit, export or delete it.`],
  [`Plans & ${brand.creditName}`, "What's free, what costs Sparks, refunds for failed generations."],
  ["Safety & reporting", "Report a companion, message or image. Block and mute."],
];

export default function HelpPage() {
  return (
    <SimplePage title="Help centre" intro="Articles are being written. Until then, these pages answer the most common questions.">
      <div className="grid gap-3 md:grid-cols-2">
        {topics.map(([t, b]) => (
          <div key={t} className="rounded-[20px] bg-surface p-5"><h2 className="font-semibold">{t}</h2><p className="mt-1 text-sm text-ink-2">{b}</p></div>
        ))}
      </div>
      <h2 className="label-caps mt-4 text-ink-3">Policies</h2>
      <div className="flex flex-wrap gap-2">
        {legalPages.map((p) => (
          <Link key={p.slug} href={`/legal/${p.slug}`} className="rounded-full bg-elevated px-3.5 py-2 text-[13px] text-ink-2 hover:text-ink">{p.title}</Link>
        ))}
      </div>
      <p className="text-sm text-ink-2">Still stuck? <Link href="/contact" className="text-rani">Contact us</Link>.</p>
    </SimplePage>
  );
}
