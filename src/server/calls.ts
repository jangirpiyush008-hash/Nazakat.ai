import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { chargeSparks } from "./sparks";

export const MAX_CALL_MINUTES = 30;

/** Charges every started minute not yet paid for. Returns false when Sparks run out. */
export async function billCallMinutes(
  admin: SupabaseClient<Database>,
  call: { id: string; user_id: string; started_at: string; minutes_charged: number; sparks_per_minute: number },
) {
  const started = Math.max(1, Math.ceil((Date.now() - new Date(call.started_at).getTime()) / 60_000));
  const due = Math.min(started, MAX_CALL_MINUTES);
  let charged = call.minutes_charged;
  while (charged < due) {
    const ok = await chargeSparks(admin, call.user_id, call.sparks_per_minute, `call-${call.id}-m${charged + 1}`, `call:${call.id}`);
    if (!ok) break;
    charged += 1;
  }
  if (charged !== call.minutes_charged) await admin.from("call_sessions").update({ minutes_charged: charged }).eq("id", call.id);
  return { ok: charged >= due && started <= MAX_CALL_MINUTES, minutes: charged };
}
