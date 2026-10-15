import type { Metadata } from "next";
import { CompanionBuilder, type Example } from "@/components/companion-builder";
import { companions } from "@/lib/companions";

export const metadata: Metadata = {
  title: "Create your companion",
  description: "Design an original AI companion: style, look, personality, voice and name.",
  alternates: { canonical: "/create" },
};

export default function CreatePage() {
  // Real characters' photos as example looks for the preview.
  const examples: Example[] = companions.flatMap((c) =>
    c.portrait ? [{ style: c.gender === "anime" ? "anime" : "realistic", gender: c.gender === "men" || /\bman\b/.test(c.appearance) ? "man" : "woman", city: c.city, photo: c.portrait }] : [],
  );
  return <CompanionBuilder examples={examples} />;
}
