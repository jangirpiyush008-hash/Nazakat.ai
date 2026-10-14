import "server-only";

/**
 * Capability flags. A modality is "available" only when its provider is
 * configured AND explicitly enabled after terms/cost review
 * (docs/PROVIDER_MATRIX.md). Never infer availability from the UI.
 */
export type Availability = "available" | "coming_soon" | "unavailable";

const enabled = (flag: string | undefined) => flag === "true";
const has = (...keys: string[]) => keys.every((k) => Boolean(process.env[k]));

export type AuthMethods = { email: boolean; phone: boolean; google: boolean; discord: boolean };

export function getCapabilities() {
  const auth = has("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return {
    auth,
    // Each method also has to be switched on in Supabase → Authentication → Providers.
    authMethods: {
      email: auth,
      phone: auth && enabled(process.env.AUTH_PHONE_ENABLED),
      google: auth && enabled(process.env.AUTH_GOOGLE_ENABLED),
      discord: auth && enabled(process.env.AUTH_DISCORD_ENABLED),
    } satisfies AuthMethods,
    chat: has("AI_CHAT_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    image:
      has("IMAGE_PROVIDER", "IMAGE_PROVIDER_API_KEY") && enabled(process.env.FEATURE_IMAGE_GEN)
        ? ("available" as Availability)
        : ("coming_soon" as Availability),
    voice:
      has("VOICE_PROVIDER", "VOICE_PROVIDER_API_KEY") && enabled(process.env.FEATURE_VOICE)
        ? ("available" as Availability)
        : ("coming_soon" as Availability),
    video: "coming_soon" as Availability,
    payments: has("PAYMENT_PROVIDER", "PAYMENT_SECRET_KEY", "PAYMENT_WEBHOOK_SECRET") && enabled(process.env.FEATURE_PAYMENTS),
  };
}

export const FREE_DAILY_MESSAGES = Number(process.env.FREE_DAILY_MESSAGES ?? 60);
export const CONSENT_VERSION = "2026-10-14-draft";
