import { brand } from "@/config/brand";
import { company, companyLabels, type CompanyKey } from "@/config/company";

/** Renders {{token}} text: company facts filled in, missing ones shown as amber placeholders. */
export function LegalText({ text }: { text: string }) {
  const parts = text.split(/(\{\{\w+\}\})/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\{\{(\w+)\}\}$/);
        if (!m) return part;
        const key = m[1];
        if (key === "brand") return brand.name;
        if (key in company) {
          const value = company[key as CompanyKey];
          if (value) return value;
          return (
            <span key={i} className="rounded bg-l-draft-bg px-1 font-mono text-[0.85em] text-l-draft-text">
              [{companyLabels[key as CompanyKey]}]
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

/** Plain-text version for metadata (placeholders become bracketed labels). */
export function legalPlain(text: string) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key === "brand" ? brand.name : key in company ? company[key as CompanyKey] || `[${companyLabels[key as CompanyKey]}]` : "",
  );
}
