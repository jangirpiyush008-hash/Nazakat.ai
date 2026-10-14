"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { brand } from "@/config/brand";
import type { AuthMethods } from "@/config/features";
import { createClient } from "@/lib/supabase/browser";
import { safeNext } from "@/lib/safe-next";

const countryCodes = [
  { code: "+91", flag: "🇮🇳" },
  { code: "+971", flag: "🇦🇪" },
  { code: "+1", flag: "🇺🇸" },
  { code: "+44", flag: "🇬🇧" },
  { code: "+65", flag: "🇸🇬" },
];

const field =
  "h-[52px] rounded-[14px] bg-bg px-4 text-[15px] outline-none placeholder:text-ink-3 focus:shadow-[0_0_0_1px_#FF2E7E,0_0_0_4px_rgba(255,46,126,.2)]";

type Step = "enter" | "code";

/**
 * Sign-up / log-in overlay, opened with `?auth=signup|login` on any public page.
 * Methods that aren't configured stay visibly disabled — nothing pretends to work.
 */
export function AuthModal({ methods }: { methods: AuthMethods }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const mode = params.get("auth");
  const next = safeNext(params.get("next"));
  const [method, setMethod] = useState<"phone" | "email">(methods.phone ? "phone" : "email");
  const [step, setStep] = useState<Step>("enter");
  const [cc, setCc] = useState("+91");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") === "link" ? "That sign-in link expired. Request a new code." : null);
  const [cooldown, setCooldown] = useState(0);
  const firstField = useRef<HTMLInputElement>(null);

  const close = () => {
    const p = new URLSearchParams(params);
    ["auth", "next", "error"].forEach((k) => p.delete(k));
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (mode !== "signup" && mode !== "login") return;
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close() is rebuilt each render
  }, [mode, step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (mode !== "signup" && mode !== "login") return null;
  const signup = mode === "signup";
  const anyEnabled = methods.email || methods.phone;
  const target = method === "phone" ? `${cc}${identifier.replace(/\D/g, "")}` : identifier.trim().toLowerCase();
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const sendCode = async () => {
    setError(null);
    if (method === "phone" && !/^\+\d{8,15}$/.test(target)) return setError("Enter a valid mobile number.");
    if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return setError("Enter a valid email address.");
    setBusy(true);
    const supabase = createClient();
    const { error } =
      method === "phone"
        ? await supabase.auth.signInWithOtp({ phone: target })
        : await supabase.auth.signInWithOtp({ email: target, options: { emailRedirectTo: callback() } });
    setBusy(false);
    if (error) {
      setError(error.status === 429 ? "Too many attempts. Please wait a minute and try again." : error.message);
      return;
    }
    setStep("code");
    setCode("");
    setCooldown(45);
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } =
      method === "phone"
        ? await supabase.auth.verifyOtp({ phone: target, token: code, type: "sms" })
        : await supabase.auth.verifyOtp({ email: target, token: code, type: "email" });
    setBusy(false);
    if (error) return setError(error.status === 429 ? "Too many attempts. Please wait a minute." : "That code didn't work. Check it or request a new one.");
    router.replace(`/app/onboarding?next=${encodeURIComponent(next)}`);
    router.refresh();
  };

  const oauth = async (provider: "google" | "discord") => {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo: callback() } });
    if (error) setError(error.message);
  };

  const swapHref = (() => {
    const p = new URLSearchParams(params);
    p.set("auth", signup ? "login" : "signup");
    p.delete("error");
    return `${pathname}?${p.toString()}`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 backdrop-blur-md md:items-center md:p-6" onClick={close}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
        className="relative grid w-full max-w-[920px] overflow-hidden rounded-t-3xl bg-surface shadow-card md:grid-cols-[1fr_1.05fr] md:rounded-3xl"
      >
        <div className="relative hidden min-h-[560px] md:block" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(255,106,61,.55),transparent_55%),radial-gradient(ellipse_at_20%_80%,rgba(255,46,126,.45),transparent_55%),linear-gradient(180deg,#2A1420,#0A0709)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(10,7,9,.9))]" />
          <div className="absolute inset-x-8 bottom-8 flex flex-col gap-2">
            <p className="font-display text-[34px] font-light leading-tight">
              Long night?
              <br />
              <em className="text-gradient">Let&apos;s</em> talk.
            </p>
            <p className="text-sm text-ink-2">{brand.tagline}</p>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-6 pb-8 md:p-10">
          <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-elevated hover:text-ink">
            <X className="size-5" />
          </button>

          {step === "enter" ? (
            <>
              <div>
                <h2 id="auth-title" className="font-display text-[32px] font-light">
                  {signup ? "Create your free account" : "Welcome back"}
                </h2>
                <p className="mt-1 text-sm text-ink-2">{signup ? "No card needed. We'll send you a one-time code." : "We'll send you a one-time code."}</p>
              </div>

              <div className="flex gap-1 rounded-full bg-bg p-1 text-[13px]" role="tablist">
                {(["phone", "email"] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    type="button"
                    aria-selected={method === m}
                    onClick={() => {
                      setMethod(m);
                      setError(null);
                      setIdentifier("");
                    }}
                    className={clsx("h-9 flex-1 rounded-full", method === m ? "bg-wine font-semibold text-rani" : "text-ink-2")}
                  >
                    {m === "phone" ? "Mobile number" : "Email"}
                    {!methods[m] && <span className="ml-1 text-[10px] text-ink-3">soon</span>}
                  </button>
                ))}
              </div>

              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendCode();
                }}
              >
                {method === "phone" ? (
                  <div className="flex gap-2">
                    <label className="sr-only" htmlFor="cc">Country code</label>
                    <select id="cc" value={cc} onChange={(e) => setCc(e.target.value)} className={clsx(field, "px-3")}>
                      {countryCodes.map((c) => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <label className="sr-only" htmlFor="phone">Mobile number</label>
                    <input ref={firstField} id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={clsx(field, "min-w-0 flex-1")} />
                  </div>
                ) : (
                  <>
                    <label className="sr-only" htmlFor="email">Email</label>
                    <input ref={firstField} id="email" type="email" autoComplete="email" placeholder="you@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={field} />
                  </>
                )}
                <button
                  type="submit"
                  disabled={!methods[method] || busy}
                  className="bg-saanjh h-[52px] rounded-[14px] text-[15px] font-semibold text-white shadow-glow-sm disabled:cursor-not-allowed disabled:bg-none disabled:bg-elevated disabled:text-ink-3 disabled:shadow-none"
                >
                  {!methods[method] ? (method === "phone" ? "Mobile sign-in opens soon — use email" : "Sign-in opens soon") : busy ? "Sending…" : "Send code"}
                </button>
              </form>

              <div className="flex items-center gap-3 text-xs text-ink-3">
                <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => oauth("google")} disabled={!methods.google} title={methods.google ? undefined : "Coming soon"} className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-[14px] bg-white text-[15px] font-semibold text-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-40">
                  <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1V17A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z"/></svg>
                  Google
                </button>
                <button type="button" onClick={() => oauth("discord")} disabled={!methods.discord} title={methods.discord ? undefined : "Coming soon"} className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-[14px] bg-[#5865F2] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 -.3 13.6.1 18.1A19.9 19.9 0 0 0 6.2 21l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6.1-2.9c.5-5.2-.9-9.8-3.6-13.7zM8.5 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>
                  Discord
                </button>
              </div>
              {!anyEnabled && <p className="text-center text-xs text-ink-3">Accounts open with the next release. Explore companions meanwhile.</p>}
            </>
          ) : (
            <>
              <div>
                <h2 id="auth-title" className="font-display text-[32px] font-light">Check your {method === "phone" ? "messages" : "inbox"}</h2>
                <p className="mt-1 text-sm text-ink-2">
                  We sent a 6-digit code to <b className="text-ink">{method === "phone" ? target : identifier}</b>.
                  {method === "email" && " You can also tap the link in the email."}
                </p>
              </div>
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  verify();
                }}
              >
                <label className="sr-only" htmlFor="otp">6-digit code</label>
                <input
                  ref={firstField}
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className={clsx(field, "text-center font-mono text-2xl tracking-[.6em] focus:shadow-[0_0_0_1px_#FF2E7E,0_0_0_4px_rgba(255,46,126,.2),0_0_24px_rgba(255,46,126,.35)]")}
                />
                <button type="submit" disabled={busy || code.length !== 6} className="bg-saanjh h-[52px] rounded-[14px] text-[15px] font-semibold text-white shadow-glow-sm disabled:opacity-50">
                  {busy ? "Checking…" : "Verify & continue"}
                </button>
              </form>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={() => setStep("enter")} className="text-ink-2 hover:text-ink">← Change {method === "phone" ? "number" : "email"}</button>
                <button type="button" disabled={cooldown > 0 || busy} onClick={sendCode} className="font-semibold text-rani disabled:text-ink-3">
                  {cooldown > 0 ? `Resend in 0:${String(cooldown).padStart(2, "0")}` : "Resend code"}
                </button>
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-sindoor/10 px-3 py-2 text-[13px] text-[#FF8DA6]">
              {error}
            </p>
          )}

          <p className="text-center text-xs leading-relaxed text-ink-3">
            By continuing you confirm you are 18+ and agree to the <Link href="/legal/terms" className="underline">Terms</Link> and{" "}
            <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
          </p>
          <p className="border-t border-white/[.07] pt-4 text-center text-sm text-ink-2">
            {signup ? "Already have an account? " : "New here? "}
            <Link href={swapHref} replace scroll={false} className="font-semibold text-rani">
              {signup ? "Log in" : "Create a free account"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
