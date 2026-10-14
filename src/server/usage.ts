import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type UsageEvent = {
  userId: string | null;
  feature: "chat" | "memory" | "safety" | "image" | "video" | "voice_note" | "call_stt" | "call_tts" | "call_llm";
  provider: string;
  model?: string | null;
  units: number;
  unit: "tokens" | "image" | "seconds" | "chars" | "minutes";
  costUsd: number;
  ok?: boolean;
};

/** Fire-and-forget cost tracking. Never blocks or fails the user's request. */
export function trackUsage(e: UsageEvent) {
  const admin = createAdminClient();
  if (!admin) return;
  void admin
    .from("usage_events")
    .insert({ user_id: e.userId, feature: e.feature, provider: e.provider, model: e.model ?? null, units: e.units, unit: e.unit, est_cost_usd: Number(e.costUsd.toFixed(6)), ok: e.ok ?? true })
    .then(({ error }) => error && console.error("usage_track_error", error.code));
}
