"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const prefs = z.object({
  display_name: z.string().trim().max(40).transform((v) => v || null),
  chat_language: z.enum(["hinglish", "hindi", "english"]),
  interest: z.enum(["women", "men", "anime"]),
  memory_enabled: z.boolean(),
  discreet_mode: z.boolean(),
  reduce_motion: z.boolean(),
});

export async function savePreferences(_: unknown, form: FormData) {
  const parsed = prefs.safeParse({
    display_name: form.get("display_name") ?? "",
    chat_language: form.get("chat_language"),
    interest: form.get("interest"),
    memory_enabled: form.get("memory_enabled") === "on",
    discreet_mode: form.get("discreet_mode") === "on",
    reduce_motion: form.get("reduce_motion") === "on",
  });
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/explore?auth=login");
  // RLS + column grants: users can only update these fields on their own row.
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", data.user.id);
  if (error) return { ok: false, message: "Couldn't save. Try again." };
  revalidatePath("/app", "layout");
  return { ok: true, message: "Saved." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Records a deletion request; the deletion workflow runs server-side (docs/RETENTION_AND_DELETION.md). */
export async function requestDeletion() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/explore?auth=login");
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Deletion requests aren't available yet. Contact support." };
  await admin.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("id", data.user.id);
  await admin.from("audit_logs").insert({ actor_id: data.user.id, action: "account.deletion_requested", target_type: "profile", target_id: data.user.id });
  return { ok: true, message: "Deletion requested. We'll confirm by email." };
}
