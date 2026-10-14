import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

/** Charge Sparks atomically. Returns false when the balance is too low. Idempotent on `key`. */
export async function chargeSparks(admin: Admin, uid: string, amount: number, key: string, ref: string) {
  const { data, error } = await admin.rpc("charge_sparks", { uid, amount, key, ref });
  if (error) throw new Error(`charge_sparks: ${error.code}`);
  return Boolean(data);
}

/** Return Sparks for a failed or blocked action. Idempotent on `key`. */
export async function refundSparks(admin: Admin, uid: string, amount: number, key: string, ref: string) {
  const { error } = await admin.rpc("refund_sparks", { uid, amount, key, ref });
  if (error) throw new Error(`refund_sparks: ${error.code}`);
}

export async function sparkBalance(admin: Admin, uid: string) {
  const { data } = await admin.rpc("spark_balance_of", { uid });
  return data ?? 0;
}
