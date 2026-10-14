"use client";

import { useEffect, useState } from "react";
import { SectionTitle } from "./ui";

/** "Trending near you", or "Trending in <city>" when the edge knows the visitor's city. */
export function TrendingHeading() {
  const [city, setCity] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((g: { city: string | null } | null) => setCity(g?.city ?? null))
      .catch(() => {});
  }, []);
  return (
    <SectionTitle className="max-md:text-[22px]">
      Trending {city ? <>in {city}</> : "near you"} <span className="text-sindoor">🔥</span>
    </SectionTitle>
  );
}
