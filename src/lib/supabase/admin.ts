import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Service-role client: BYPASSES RLS. Server-only, used for writes users must
 * not perform themselves (assistant messages, metering, ledger). Returns null
 * when the key is not configured so callers can show an honest unavailable state.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
