/**
 * DRAFT pricing. Display-only until a payment provider is approved; the server
 * must own real prices (plans table) before checkout. Amounts in paise, GST
 * included. India-first: a no-renew weekly "sachet", Plus by month/quarter/year,
 * and small one-time Sparks packs that suit UPI.
 *
 * Savings are COMPUTED against the monthly price. Never hard-code a fake
 * "original" price or discount.
 */
export const pricingStatus = "draft" as const;

export type Period = "monthly" | "quarterly" | "yearly";

export const plusPeriods: Record<Period, { label: string; months: number; pricePaise: number }> = {
  monthly: { label: "Monthly", months: 1, pricePaise: 29900 },
  quarterly: { label: "3 months", months: 3, pricePaise: 79900 },
  yearly: { label: "12 months", months: 12, pricePaise: 249900 },
};

export function plusOffer(period: Period) {
  const p = plusPeriods[period];
  const fullPrice = plusPeriods.monthly.pricePaise * p.months;
  return {
    ...p,
    perMonthPaise: Math.round(p.pricePaise / p.months),
    savingPct: Math.round((1 - p.pricePaise / fullPrice) * 100),
  };
}

export const plusFeatures = [
  "Much higher daily chat limit",
  "Longer memory per companion",
  "Monthly ✦ Sparks grant",
  "Create your own companions",
  "Priority replies at peak hours",
];

export const weeklyPass = {
  name: "Weekly pass",
  pricePaise: 4900,
  features: ["Plus limits for 7 days", "Does not auto-renew", "Try before you commit"],
};

export const sparkPacks = [
  { sparks: 100, pricePaise: 9900 },
  { sparks: 250, pricePaise: 19900 },
  { sparks: 700, pricePaise: 49900, popular: true },
  { sparks: 1500, pricePaise: 99900 },
];

/**
 * Sparks per action. 1 Spark is roughly ₹1 at pack prices (₹99 = 100 ✦).
 * Defaults leave margin over typical provider cost; check against your fal.ai
 * and ElevenLabs invoices and override with env vars without a code change.
 */
const envInt = (raw: string | undefined, fallback: number) => {
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback;
};

export const videoDurations = [5, 8, 10, 15] as const;
export type VideoDuration = (typeof videoDurations)[number];

export const sparkCosts = {
  image: envInt(process.env.NEXT_PUBLIC_SPARKS_IMAGE, 10),
  video: {
    5: envInt(process.env.NEXT_PUBLIC_SPARKS_VIDEO_5, 60),
    8: envInt(process.env.NEXT_PUBLIC_SPARKS_VIDEO_8, 95),
    10: envInt(process.env.NEXT_PUBLIC_SPARKS_VIDEO_10, 120),
    15: envInt(process.env.NEXT_PUBLIC_SPARKS_VIDEO_15, 180),
  } satisfies Record<VideoDuration, number>,
  voicePerMinute: envInt(process.env.NEXT_PUBLIC_SPARKS_CALL_MINUTE, 12),
  voiceNote: envInt(process.env.NEXT_PUBLIC_SPARKS_VOICE_NOTE, 3),
};

/** One-time promo Sparks on finishing onboarding (set in SQL: complete_onboarding). */
export const WELCOME_SPARKS = 50;

export function formatINR(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}
