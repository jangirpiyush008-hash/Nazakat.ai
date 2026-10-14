import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { companions } from "@/lib/companions";
import { legalPages } from "@/lib/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/explore", "/create", "/pricing", "/how-it-works", "/help", "/contact",
    ...companions.map((c) => `/companions/${c.slug}`),
    ...legalPages.map((p) => `/legal/${p.slug}`)];
  return paths.map((p) => ({ url: `${brand.url}${p}` }));
}
