import type { Metadata } from "next";
import { CompanionBuilder } from "@/components/companion-builder";

export const metadata: Metadata = {
  title: "Create your companion",
  description: "Design an original AI companion: style, look, personality, voice and name.",
  alternates: { canonical: "/create" },
};

export default function CreatePage() {
  return <CompanionBuilder />;
}
