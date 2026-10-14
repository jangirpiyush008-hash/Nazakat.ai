import type { Metadata, Viewport } from "next";
import { Manrope, Mukta, Newsreader, Tiro_Devanagari_Hindi } from "next/font/google";
import { brand } from "@/config/brand";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope", display: "swap" });
const tiro = Tiro_Devanagari_Hindi({ subsets: ["devanagari", "latin"], weight: "400", variable: "--font-tiro", display: "swap" });
const mukta = Mukta({ subsets: ["devanagari", "latin"], weight: ["400", "500", "600"], variable: "--font-mukta", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: { default: `${brand.name} — AI companions who remember`, template: `%s · ${brand.name}` },
  description: `${brand.tagline} Original fictional AI characters. Hinglish, Hindi or English. 18+.`,
  openGraph: { siteName: brand.domainLabel, type: "website", locale: "en_IN" },
};

export const viewport: Viewport = { themeColor: "#0A0709", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${newsreader.variable} ${manrope.variable} ${tiro.variable} ${mukta.variable}`}>
      <body className="grain min-h-dvh">{children}</body>
    </html>
  );
}
