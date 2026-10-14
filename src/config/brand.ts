/**
 * Central brand config. "Nazakat" is a working name — trademark/domain not
 * cleared (see docs/DECISIONS.md). Change it here, nowhere else.
 */
export const brand = {
  name: "Nazakat",
  domainLabel: "Nazakat.ai",
  creditName: "Sparks",
  creditGlyph: "✦",
  tagline: "Evening conversations with characters who remember.",
  minAge: 18,
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const disclosureLines = [
  "Companions are AI-generated and fictional",
  "Not therapy, medical or emergency support",
  `Working name · trademark pending · ${brand.minAge}+`,
] as const;
