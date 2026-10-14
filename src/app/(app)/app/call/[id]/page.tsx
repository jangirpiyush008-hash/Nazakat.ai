import { notFound } from "next/navigation";
import { getCapabilities } from "@/config/features";
import { sparkCosts } from "@/config/pricing";
import { requireOnboarded } from "@/server/session";
import { CallScreen } from "@/components/call/call-screen";

export const metadata = { title: "Voice call" };
type Params = Promise<{ id: string }>;

/** Voice call with the companion of conversation `id`. */
export default async function CallPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase } = await requireOnboarded(`/app/call/${id}`);
  const { data: convo } = await supabase.from("conversations").select("id, companion_id").eq("id", id).maybeSingle();
  if (!convo) notFound();
  const [{ data: companion }, { data: balance }] = await Promise.all([
    supabase.from("companions").select("name, wash, city").eq("id", convo.companion_id).single(),
    supabase.rpc("spark_balance"),
  ]);
  if (!companion) notFound();
  return (
    <CallScreen
      conversationId={id}
      name={companion.name}
      wash={companion.wash}
      city={companion.city}
      available={getCapabilities().voice === "available"}
      sparksPerMinute={sparkCosts.voicePerMinute}
      balance={Math.max(0, balance ?? 0)}
    />
  );
}
