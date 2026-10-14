import Link from "next/link";
import { brand } from "@/config/brand";
import { sparkCosts, videoDurations } from "@/config/pricing";
import { requireOnboarded } from "@/server/session";

export const metadata = { title: "Sparks wallet" };

const kindLabel: Record<string, string> = {
  grant: "Bonus",
  purchase: "Purchase",
  consumption: "Spent",
  reservation: "Reserved",
  release: "Released",
  refund: "Refund",
  adjustment: "Adjustment",
};

function describe(ref: string | null) {
  if (!ref) return "";
  if (ref === "welcome") return "Welcome Sparks";
  if (ref.startsWith("image:")) return "Photo";
  if (ref.startsWith("video:")) return "Video";
  if (ref.startsWith("call:")) return "Voice call minute";
  return ref;
}

export default async function WalletPage() {
  const { supabase } = await requireOnboarded("/app/wallet");
  const [{ data: balance }, { data: rows }] = await Promise.all([
    supabase.rpc("spark_balance"),
    supabase.from("credit_ledger").select("id, kind, bucket, amount, reference, expires_at, created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const promo = (rows ?? []).filter((r) => r.bucket === "promo" && r.kind === "grant" && r.expires_at && new Date(r.expires_at) > new Date());

  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-6 px-4 py-8">
      <section className="flex flex-col gap-3 rounded-3xl bg-[linear-gradient(135deg,#FFB423,#FF6A3D)] p-6 text-on-gold">
        <span className="label-caps text-[11px]">{brand.creditName} balance</span>
        <span className="font-display text-[60px] leading-none">✦ {Math.max(0, balance ?? 0)}</span>
        {promo[0] && (
          <span className="text-xs">
            Includes bonus Sparks valid until {new Date(promo[0].expires_at!).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
          </span>
        )}
        <Link href="/pricing" className="self-start rounded-[14px] bg-on-gold px-5 py-3 text-sm font-semibold text-marigold">Top up</Link>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="label-caps text-ink-3">What Sparks pay for</h2>
        <div className="grid gap-1.5 text-sm">
          <div className="flex justify-between rounded-[14px] bg-surface px-4 py-3"><span>Photo</span><b className="text-marigold">✦ {sparkCosts.image}</b></div>
          {videoDurations.map((d) => (
            <div key={d} className="flex justify-between rounded-[14px] bg-surface px-4 py-3"><span>Video · {d} seconds</span><b className="text-marigold">✦ {sparkCosts.video[d]}</b></div>
          ))}
          <div className="flex justify-between rounded-[14px] bg-surface px-4 py-3"><span>Voice call</span><b className="text-marigold">✦ {sparkCosts.voicePerMinute} / min</b></div>
          <div className="flex justify-between rounded-[14px] bg-surface px-4 py-3 text-ink-2"><span>Text chat</span><span>Free daily allowance</span></div>
        </div>
        <p className="text-xs text-ink-3">Failed or blocked generations are refunded automatically.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="label-caps text-ink-3">History</h2>
        {rows?.length ? (
          <ul className="flex flex-col divide-y divide-white/[.06] rounded-2xl bg-surface">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="block">{describe(r.reference) || kindLabel[r.kind]}</span>
                  <span className="text-xs text-ink-3">
                    {kindLabel[r.kind]} · {new Date(r.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  </span>
                </span>
                <b className={r.amount > 0 ? "text-marigold" : "text-ink-2"}>
                  {r.amount > 0 ? "+" : "−"}✦ {Math.abs(r.amount)}
                </b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm text-ink-3">No Sparks activity yet.</p>
        )}
      </section>
    </main>
  );
}
