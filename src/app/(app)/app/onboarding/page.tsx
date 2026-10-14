import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CONSENT_VERSION } from "@/config/features";
import { INTEREST_COOKIE } from "@/lib/prefs";
import { safeNext } from "@/lib/safe-next";
import { requireUser } from "@/server/session";
import { OnboardingForm } from "@/components/onboarding-form";

export const metadata = { title: "Before you start" };

type SP = Promise<{ next?: string }>;

export default async function OnboardingPage({ searchParams }: { searchParams: SP }) {
  const next = safeNext((await searchParams).next);
  const { profile } = await requireUser("/app/onboarding");
  if (profile.onboarded_at && profile.age_confirmed_at) redirect(next);
  const saved = (await cookies()).get(INTEREST_COOKIE)?.value;
  const interest = saved === "men" || saved === "anime" ? saved : "women";
  return <OnboardingForm next={next} consentVersion={CONSENT_VERSION} defaultInterest={interest} />;
}
