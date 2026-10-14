import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

type BtnSize = "md" | "lg";

const sizes: Record<BtnSize, string> = {
  md: "h-12 px-[22px] text-sm",
  lg: "h-14 px-7 text-base",
};

export function primaryClasses(size: BtnSize = "md", className?: string) {
  return clsx(
    "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[14px] font-semibold text-white",
    "bg-saanjh shadow-glow-sm transition-transform duration-200 ease-out hover:-translate-y-0.5",
    sizes[size],
    className,
  );
}

export function glassClasses(size: BtnSize = "md", className?: string) {
  return clsx(
    "glass inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold text-ink transition-colors duration-200 hover:bg-white/10",
    sizes[size],
    className,
  );
}

function Shimmer() {
  return (
    <span
      aria-hidden
      className="animate-shimmer pointer-events-none absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/35 to-transparent"
    />
  );
}

export function PrimaryLink({
  size,
  shimmer,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { size?: BtnSize; shimmer?: boolean }) {
  return (
    <Link className={primaryClasses(size, className)} {...props}>
      {children}
      {shimmer && <Shimmer />}
    </Link>
  );
}

export function GlassLink({ size, className, ...props }: ComponentProps<typeof Link> & { size?: BtnSize }) {
  return <Link className={glassClasses(size, className)} {...props} />;
}

/** Disabled purchase CTA — used until a payment provider is approved. */
export function DisabledButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled
      className={clsx(
        "inline-flex h-12 cursor-not-allowed items-center justify-center rounded-[14px] bg-elevated px-[22px] text-sm font-semibold text-ink-3",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({
  selected,
  soon,
  href,
  deva,
  children,
}: {
  selected?: boolean;
  soon?: boolean;
  href?: string;
  deva?: boolean;
  children: ReactNode;
}) {
  const cls = clsx(
    "inline-flex h-[34px] flex-none items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors",
    deva && "font-deva",
    selected
      ? "border border-rani bg-wine font-semibold text-rani"
      : soon
        ? "bg-elevated text-ink-3"
        : "bg-elevated text-ink-2 hover:text-ink",
  );
  const body = (
    <>
      {children}
      {soon && <i className="text-[10px] not-italic">soon</i>}
    </>
  );
  if (soon || !href)
    return (
      <span className={cls} aria-disabled={soon || undefined}>
        {body}
      </span>
    );
  return (
    <Link href={href} className={cls} aria-pressed={selected} scroll={false}>
      {body}
    </Link>
  );
}

export function AiPill({ children = "AI character" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-full bg-white/10 px-2.5 text-[11px] font-semibold backdrop-blur-md">
      {children}
    </span>
  );
}

export function SparksBadge({ amount }: { amount: number | string }) {
  return (
    <span className="inline-flex h-[34px] items-center rounded-full bg-marigold/12 px-3 text-[13px] font-bold text-marigold">
      ✦ {amount}
    </span>
  );
}

/** Blurred ambient radial glow — decorative, behind heroes and headers. */
export function Glow({
  size,
  className,
  from = "rgba(255,46,126,.45)",
  via = "rgba(255,106,61,.18)",
}: {
  size: number;
  className?: string;
  from?: string;
  via?: string;
}) {
  return (
    <div
      aria-hidden
      className={clsx("animate-glow-drift pointer-events-none absolute rounded-full blur-[60px]", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${from}, ${via} 40%, transparent 70%)`,
      }}
    />
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={clsx("font-display text-[28px] font-light md:text-4xl", className)}>{children}</h2>;
}
