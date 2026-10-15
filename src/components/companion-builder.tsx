"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

export type Example = { style: "realistic" | "anime"; gender: "woman" | "man"; city: string; photo: string };

/** Best example photo for the current choices: same style + gender (+ city if we have one). */
function pickExample(examples: Example[], style: Example["style"], gender: Example["gender"], city: string) {
  const pool = examples.filter((e) => e.style === style);
  return (
    pool.find((e) => e.gender === gender && e.city === city) ??
    pool.find((e) => e.gender === gender) ??
    pool[0] ??
    null
  );
}

const steps = ["Style", "Look", "Personality", "Voice", "Name"] as const;

const cities = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Kolkata", "Jaipur", "Pune", "Chennai", "Lucknow", "Goa"];
const traits = ["Romantic", "Flirty", "Witty", "Shy", "Bold", "Poetic", "Caring", "Teasing", "Filmy", "Intellectual"];
const languages = ["Hinglish", "Hindi", "English"];
const voices = ["Soft Mumbai", "Husky Delhi", "Calm Bengaluru", "Sweet Kolkata", "Bold Punjabi", "Deep baritone"];
const MIN_AGE = 25;

type Draft = {
  style: "realistic" | "anime";
  gender: "woman" | "man";
  age: number;
  city: string;
  playful: number;
  bold: number;
  traits: string[];
  language: string;
  voice: string;
  name: string;
};

const initial: Draft = {
  style: "realistic",
  gender: "woman",
  age: 27,
  city: "Mumbai",
  playful: 35,
  bold: 70,
  traits: ["Romantic", "Witty"],
  language: "Hinglish",
  voice: "Soft Mumbai",
  name: "",
};

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={clsx("inline-flex h-10 items-center rounded-full px-4 text-[13px]", on ? "border border-rani bg-wine font-semibold text-rani" : "bg-elevated text-ink-2 hover:text-ink")}
    >
      {children}
    </button>
  );
}

function Slider({ left, right, value, onChange }: { left: string; right: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="flex justify-between text-ink-2">
        <span>{left}</span>
        <span>{right}</span>
      </span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-rani" aria-label={`${left} to ${right}`} />
    </label>
  );
}

/**
 * Companion builder (design: home "Create your own companion" preview).
 * Client-side draft only. Saving needs an account and server-side checks
 * (name/likeness, age ≥ 25, moderation) that land with Milestone 3.
 */
export function CompanionBuilder({ examples = [] }: { examples?: Example[] }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const toggleTrait = (t: string) =>
    set("traits", d.traits.includes(t) ? d.traits.filter((x) => x !== t) : d.traits.length < 3 ? [...d.traits, t] : d.traits);
  const nameOk = /^[\p{L} ]{2,20}$/u.test(d.name.trim());
  const last = step === steps.length - 1;
  const example = pickExample(examples, d.style, d.gender, d.city);

  return (
    <main className="mx-auto flex max-w-[880px] flex-col gap-8 px-5 py-10 md:px-8 md:py-14">
      <header className="flex flex-col gap-3 text-center">
        <h1 className="font-display text-[36px] font-light leading-tight md:text-5xl">
          Create your <em className="text-gradient">companion</em>
        </h1>
        <p className="text-sm text-ink-2">Original characters only — no real people, no one under {MIN_AGE}.</p>
      </header>

      <ol className="flex gap-2" aria-label="Steps">
        {steps.map((s, n) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5">
            <span className={clsx("h-1 rounded-full", n <= step ? "bg-saanjh" : "bg-elevated")} />
            <span className={clsx("text-[11px]", n === step ? "font-semibold text-ink" : "text-ink-3")}>{s}</span>
          </li>
        ))}
      </ol>

      <section className="grid gap-8 md:grid-cols-[220px_1fr]">
        {/* Live preview */}
        <div className="relative mx-auto aspect-[3/4] w-[200px] overflow-hidden rounded-[20px] md:w-full" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                d.style === "anime"
                  ? "radial-gradient(ellipse at 50% 20%, rgba(167,139,250,.55), transparent 60%), linear-gradient(180deg,#24121F,#0A0709)"
                  : "radial-gradient(ellipse at 60% 20%, rgba(255,106,61,.5), transparent 55%), radial-gradient(ellipse at 20% 85%, rgba(255,46,126,.35), transparent 55%), linear-gradient(180deg,#2A1420,#0A0709)",
            }}
          />
          {example && <Image key={example.photo} src={example.photo} alt="" fill sizes="220px" className="object-cover" />}
          {example && <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md">Example look</span>}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(10,7,9,.95)_92%)]" />
          <div className="absolute inset-x-3 bottom-3">
            <div className="font-display text-xl">{d.name.trim() || "Your companion"}</div>
            <div className="text-xs text-ink-2">
              {d.age} · {d.city} · {d.language}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {d.traits.map((t) => (
                <span key={t} className="rounded-full bg-white/10 px-2 py-[3px] text-[11px]">{t}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-[280px] flex-col gap-6">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {(["realistic", "anime"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("style", s)}
                  aria-pressed={d.style === s}
                  className={clsx(
                    "relative flex aspect-[4/5] items-end justify-center overflow-hidden rounded-[20px] pb-4 text-lg font-semibold capitalize",
                    d.style === s ? "text-rani shadow-[0_0_0_2px_#FF2E7E,0_10px_40px_rgba(255,46,126,.3)]" : "text-ink-2",
                  )}
                  style={{
                    background:
                      s === "anime"
                        ? "radial-gradient(ellipse at 50% 25%, rgba(167,139,250,.45), transparent 60%), #141015"
                        : "radial-gradient(ellipse at 50% 25%, rgba(255,106,61,.45), transparent 60%), #141015",
                  }}
                >
                  {(() => {
                    const ex = pickExample(examples, s, d.gender, d.city);
                    return ex ? <Image src={ex.photo} alt="" fill sizes="(max-width: 768px) 45vw, 300px" className="object-cover" /> : null;
                  })()}
                  <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(10,7,9,.9))]" />
                  <span className="relative">{s}</span>
                  {d.style === s && (
                    <span className="bg-saanjh absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-white">
                      <Check className="size-4" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="flex flex-col gap-2">
                <span className="label-caps text-ink-3">Companion</span>
                <div className="flex gap-2">
                  <Pill on={d.gender === "woman"} onClick={() => set("gender", "woman")}>Woman</Pill>
                  <Pill on={d.gender === "man"} onClick={() => set("gender", "man")}>Man</Pill>
                </div>
              </div>
              <label className="flex flex-col gap-2">
                <span className="label-caps flex justify-between text-ink-3">
                  Age <span className="text-ink">{d.age}</span>
                </span>
                <input type="range" min={MIN_AGE} max={45} value={d.age} onChange={(e) => set("age", Number(e.target.value))} className="accent-rani" />
              </label>
              <div className="flex flex-col gap-2">
                <span className="label-caps text-ink-3">City</span>
                <div className="flex flex-wrap gap-2">
                  {cities.map((c) => (
                    <Pill key={c} on={d.city === c} onClick={() => set("city", c)}>{c}</Pill>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Slider left="Playful" right="Serious" value={d.playful} onChange={(v) => set("playful", v)} />
              <Slider left="Shy" right="Bold" value={d.bold} onChange={(v) => set("bold", v)} />
              <div className="flex flex-col gap-2">
                <span className="label-caps text-ink-3">Up to 3 traits</span>
                <div className="flex flex-wrap gap-2">
                  {traits.map((t) => (
                    <Pill key={t} on={d.traits.includes(t)} onClick={() => toggleTrait(t)}>{t}</Pill>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex flex-col gap-2">
                <span className="label-caps text-ink-3">Chat language</span>
                <div className="flex gap-2">
                  {languages.map((l) => (
                    <Pill key={l} on={d.language === l} onClick={() => set("language", l)}>{l}</Pill>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="label-caps text-ink-3">Voice</span>
                <div className="flex flex-wrap gap-2">
                  {voices.map((v) => (
                    <Pill key={v} on={d.voice === v} onClick={() => set("voice", v)}>{v}</Pill>
                  ))}
                </div>
                <p className="text-xs text-ink-3">Voice previews arrive with voice notes.</p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <label className="flex flex-col gap-2">
                <span className="label-caps text-ink-3">Name</span>
                <input
                  value={d.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={20}
                  placeholder="e.g. Tara"
                  className="h-[52px] rounded-[14px] bg-surface px-4 text-[15px] outline-none placeholder:text-ink-3 focus:shadow-[0_0_0_1px_#FF2E7E,0_0_0_4px_rgba(255,46,126,.2)]"
                />
                <span className="text-xs text-ink-3">Letters only. Don&apos;t use a real person&apos;s or celebrity&apos;s name.</span>
              </label>
              <div className="rounded-2xl bg-surface p-4 text-sm leading-relaxed text-ink-2">
                {d.name.trim() || "Your companion"} is a {d.age}-year-old {d.style === "anime" ? "anime-style " : ""}
                {d.gender} from {d.city} who speaks {d.language}: {d.traits.join(", ").toLowerCase() || "easy-going"}.
              </div>
            </>
          )}

          <div className="mt-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="glass inline-flex h-12 items-center gap-2 rounded-[14px] px-5 text-sm font-semibold disabled:invisible"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
            {last ? (
              <Link
                href={nameOk ? "?auth=signup&next=/create" : "#"}
                scroll={false}
                aria-disabled={!nameOk}
                className={clsx(
                  "inline-flex h-12 items-center gap-2 rounded-[14px] px-6 text-sm font-semibold",
                  nameOk ? "bg-saanjh text-white shadow-glow-sm" : "pointer-events-none bg-elevated text-ink-3",
                )}
              >
                Save &amp; start chatting
              </Link>
            ) : (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="bg-saanjh inline-flex h-12 items-center gap-2 rounded-[14px] px-6 text-sm font-semibold text-white shadow-glow-sm">
                Next <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
