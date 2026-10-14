import clsx from "clsx";
import { brand } from "@/config/brand";

const sizes = { sm: "text-[20px]", md: "text-[24px] md:text-[28px]", lg: "text-[28px]" } as const;

/**
 * Logo option 8 (two-weight type): "naza" in regular weight, "kat" in bold
 * rani pink, with a small marigold dot. `tone="light"` is for the light theme.
 */
export function Wordmark({ size = "md", tone = "dark", className }: { size?: keyof typeof sizes; tone?: "dark" | "light"; className?: string }) {
  const [first, second] = brand.wordmark;
  return (
    <span className={clsx("inline-flex items-baseline font-ui tracking-[.02em] leading-none", sizes[size], className)}>
      <span className={clsx("font-medium", tone === "dark" ? "text-ink" : "text-l-text")}>{first}</span>
      <span className={clsx("font-extrabold", tone === "dark" ? "text-rani" : "text-l-primary")}>{second}</span>
      <span aria-hidden className="ml-[2px] size-[.26em] self-end rounded-full bg-marigold" style={{ marginBottom: ".12em" }} />
    </span>
  );
}
