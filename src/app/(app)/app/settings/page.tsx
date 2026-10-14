import Link from "next/link";
import { requireOnboarded } from "@/server/session";
import { SettingsForm } from "@/components/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, profile } = await requireOnboarded("/app/settings");
  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="font-display text-[36px] font-light">Settings</h1>
        <p className="text-sm text-ink-3">Signed in as {user.email ?? user.phone}</p>
      </header>
      <SettingsForm
        profile={{
          display_name: profile.display_name ?? "",
          chat_language: profile.chat_language,
          interest: profile.interest,
          memory_enabled: profile.memory_enabled,
          discreet_mode: profile.discreet_mode,
          reduce_motion: profile.reduce_motion,
          deletion_requested: Boolean(profile.deletion_requested_at),
        }}
      />
      <p className="text-xs text-ink-3">
        <Link href="/legal/privacy" className="underline">Privacy</Link> · <Link href="/legal/data-retention-and-deletion" className="underline">Data retention &amp; deletion</Link> · <Link href="/legal/ai-disclosure" className="underline">AI disclosure</Link>
      </p>
    </main>
  );
}
