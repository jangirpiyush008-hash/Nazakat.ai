"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { requestDeletion, savePreferences, signOut } from "@/app/(app)/app/settings/actions";

type Profile = {
  display_name: string;
  chat_language: string;
  interest: string;
  memory_enabled: boolean;
  discreet_mode: boolean;
  reduce_motion: boolean;
  deletion_requested: boolean;
};

function Switch({ name, label, hint, defaultOn }: { name: string; label: string; hint: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-surface p-4">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-ink-3">{hint}</span>
      </span>
      <input type="checkbox" name={name} checked={on} onChange={(e) => setOn(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={clsx("relative h-7 w-12 flex-none rounded-full transition-colors peer-focus-visible:shadow-[0_0_0_4px_rgba(255,46,126,.3)]", on ? "bg-saanjh" : "bg-elevated")}>
        <span className={clsx("absolute top-1 size-5 rounded-full bg-white transition-all", on ? "left-6" : "left-1")} />
      </span>
    </label>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4 text-sm font-semibold">
      {label}
      <select name={name} defaultValue={value} className="h-10 rounded-xl bg-bg px-3 text-sm font-normal outline-none focus:shadow-[0_0_0_1px_#FF2E7E]">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

export function SettingsForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(savePreferences, null);
  const [del, delAction, deleting] = useActionState(requestDeletion, null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <form action={action} className="flex flex-col gap-3">
        <h2 className="label-caps mt-2 text-ink-3">Chat</h2>
        <label className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4 text-sm font-semibold">
          What should companions call you?
          <input name="display_name" defaultValue={profile.display_name} maxLength={40} placeholder="Your name" className="h-10 w-40 rounded-xl bg-bg px-3 text-sm font-normal outline-none focus:shadow-[0_0_0_1px_#FF2E7E]" />
        </label>
        <Select name="chat_language" label="Companions reply in" value={profile.chat_language} options={[["hinglish", "Hinglish"], ["hindi", "Hindi"], ["english", "English"]]} />
        <Select name="interest" label="Interested in" value={profile.interest} options={[["women", "Women"], ["men", "Men"], ["anime", "Anime"]]} />

        <h2 className="label-caps mt-4 text-ink-3">Privacy</h2>
        <Switch name="memory_enabled" label="Save new memories" hint="Companions remember short facts you share. Existing memories stay until you delete them." defaultOn={profile.memory_enabled} />
        <Switch name="discreet_mode" label="Discreet mode" hint="Neutral app name in the tab, and the screen blurs when you switch away." defaultOn={profile.discreet_mode} />
        <Switch name="reduce_motion" label="Reduce motion" hint="Turns off floating, shimmer and glow animations." defaultOn={profile.reduce_motion} />

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="bg-saanjh h-12 rounded-[14px] px-6 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? "Saving…" : "Save changes"}
          </button>
          {state && <span role="status" className={clsx("text-sm", state.ok ? "text-marigold" : "text-[#FF8DA6]")}>{state.message}</span>}
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="label-caps mt-4 text-ink-3">Account</h2>
        <form action={signOut}>
          <button type="submit" className="glass h-12 w-full rounded-[14px] text-sm font-semibold">Log out</button>
        </form>
        <div className="rounded-2xl bg-surface p-4">
          <div className="text-sm font-semibold text-sindoor">Delete account</div>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            Deletes your profile, chats, memories and Sparks. Some records (payments, safety reports) may be kept where the law requires. This can&apos;t be undone.
          </p>
          {profile.deletion_requested || del?.ok ? (
            <p className="mt-3 text-sm text-marigold">Deletion requested. We&apos;ll confirm by email.</p>
          ) : confirmDelete ? (
            <form action={delAction} className="mt-3 flex gap-2">
              <button type="submit" disabled={deleting} className="h-10 rounded-xl bg-sindoor px-4 text-sm font-semibold text-white">Yes, delete my account</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-10 rounded-xl bg-elevated px-4 text-sm">Cancel</button>
            </form>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="mt-3 text-sm font-semibold text-sindoor">Request deletion…</button>
          )}
          {del && !del.ok && <p className="mt-2 text-xs text-[#FF8DA6]">{del.message}</p>}
        </div>
      </section>
    </>
  );
}
