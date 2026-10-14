import "server-only";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";

/** Signed-in user + profile, or a redirect to log-in. Middleware also guards /app. */
export async function requireUser(nextPath = "/app") {
  const { supabase, user } = await getUser();
  if (!user) redirect(`/explore?auth=login&next=${encodeURIComponent(nextPath)}`);
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect(`/explore?auth=login&next=${encodeURIComponent(nextPath)}`);
  return { supabase, user, profile };
}

/** Same, but sends people who haven't finished consent/onboarding there first. */
export async function requireOnboarded(nextPath = "/app") {
  const ctx = await requireUser(nextPath);
  if (!ctx.profile.onboarded_at || !ctx.profile.age_confirmed_at) redirect(`/app/onboarding?next=${encodeURIComponent(nextPath)}`);
  return ctx;
}
