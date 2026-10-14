"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { MessageCircle, Mic, MicOff, Phone, PhoneOff } from "lucide-react";

type Phase = "preflight" | "ringing" | "listening" | "thinking" | "speaking" | "ended" | "error";
type Turn = { role: "user" | "assistant"; content: string };

const SILENCE_MS = 1000; // end of a spoken turn
const MIN_SPEECH_MS = 350;
const MIN_RING_MS = 2400; // let it ring at least once
const LEVEL_FLOOR = 0.012;

/**
 * Turn-based voice call: it rings, the character picks up and says hello,
 * then the browser listens, detects when you stop talking, sends that clip
 * and plays the spoken reply. Billing is per started minute on the server;
 * audio is never stored.
 *
 * All sound goes through one AudioContext created on the Call tap, so
 * browsers (incl. iOS Safari) never block it as autoplay.
 */
export function CallScreen(props: {
  conversationId: string;
  name: string;
  age: number | null;
  portrait: string | null;
  wash: string;
  city: string;
  available: boolean;
  sparksPerMinute: number;
  balance: number;
}) {
  const [phase, setPhase] = useState<Phase>("preflight");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const callId = useRef<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const history = useRef<Turn[]>([]);
  const phaseRef = useRef<Phase>("preflight");
  const mutedRef = useRef(false);
  const playing = useRef<AudioBufferSourceNode | null>(null);
  const stopRing = useRef<(() => void) | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const hangUp = useCallback(async (reason?: string) => {
    if (phaseRef.current === "ended") return;
    go("ended");
    if (reason) setError(reason);
    stopRing.current?.();
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    try {
      playing.current?.stop();
    } catch {}
    ctx.current?.close().catch(() => {});
    if (callId.current) {
      const r = await fetch("/api/call/end", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId: callId.current }) }).then((x) => x.json()).catch(() => null);
      if (r?.minutes) setMinutes(r.minutes);
    }
  }, []);

  useEffect(() => () => void hangUp(), [hangUp]);

  useEffect(() => {
    if (phase === "preflight" || phase === "ended" || phase === "error" || phase === "ringing") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => logEnd.current?.scrollIntoView({ block: "end" }), [transcript]);

  /** Indian-style double ring (400+450 Hz) until stopped. */
  const ring = (ac: AudioContext) => {
    const gain = ac.createGain();
    gain.gain.value = 0;
    gain.connect(ac.destination);
    const oscs = [400, 450].map((f) => {
      const o = ac.createOscillator();
      o.frequency.value = f;
      o.connect(gain);
      o.start();
      return o;
    });
    let stopped = false;
    const schedule = (t0: number) => {
      // ring 0.4s, pause 0.2s, ring 0.4s, pause 2s
      for (const [on, off] of [[0, 0.4], [0.6, 1.0]]) {
        gain.gain.setValueAtTime(0.12, t0 + on);
        gain.gain.setValueAtTime(0, t0 + off);
      }
    };
    let next = ac.currentTime + 0.05;
    schedule(next);
    const timer = setInterval(() => {
      if (stopped) return;
      next += 3;
      schedule(next);
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
      gain.gain.cancelScheduledValues(0);
      gain.gain.value = 0;
      oscs.forEach((o) => o.stop());
      gain.disconnect();
    };
  };

  const play = async (base64: string) => {
    const ac = ctx.current;
    if (!ac) return;
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
    const buf = await ac.decodeAudioData(bytes.buffer);
    await ac.resume();
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    playing.current = src;
    await new Promise<void>((resolve) => {
      src.onended = () => resolve();
      src.start();
    });
  };

  const say = async (reply: string, audio: string) => {
    history.current.push({ role: "assistant", content: reply });
    setTranscript((t) => [...t, { role: "assistant", content: reply }]);
    go("speaking");
    try {
      await play(audio);
    } catch {
      /* undecodable audio: the caption is still shown */
    }
    if (phaseRef.current === "speaking") go("listening");
  };

  const turn = async (form: FormData) => {
    form.append("callId", callId.current!);
    form.append("history", JSON.stringify(history.current.slice(-12)));
    const res = await fetch("/api/call/turn", { method: "POST", body: form }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : { error: "network" };
    if (j.minutes) setMinutes(j.minutes);
    return { ok: Boolean(res?.ok), j };
  };

  const sendTurn = async (blob: Blob) => {
    go("thinking");
    const form = new FormData();
    form.append("audio", blob, blob.type.includes("ogg") ? "turn.ogg" : blob.type.includes("mp4") ? "turn.m4a" : "turn.webm");
    const { ok, j } = await turn(form);
    if (phaseRef.current === "ended") return;
    if (!ok) {
      if (j.error === "insufficient_sparks") return hangUp("You're out of Sparks, so the call ended.");
      if (j.error === "ended") return hangUp();
      setTranscript((t) => [...t, { role: "assistant", content: j.error === "refused" ? "Let's talk about something else." : "Sorry, I didn't catch that. Say it again?" }]);
      return go("listening");
    }
    if (j.empty) return go("listening");
    history.current.push({ role: "user", content: j.heard });
    setTranscript((t) => [...t, { role: "user", content: j.heard }]);
    await say(j.reply, j.audio);
  };

  const listen = (s: MediaStream, ac: AudioContext) => {
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    ac.createMediaStreamSource(s).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let speakingSince = 0;
    let lastVoice = 0;
    let noise = 0.01; // running estimate of room noise
    let frame = 0;

    const startRec = () => {
      chunks.current = [];
      const mime = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        const dur = lastVoice - speakingSince;
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
        if (dur >= MIN_SPEECH_MS && phaseRef.current === "listening") sendTurn(blob);
      };
      rec.start();
      recorder.current = rec;
    };

    const tick = () => {
      if (phaseRef.current === "ended") return;
      analyser.getFloatTimeDomainData(data);
      const lvl = Math.sqrt(data.reduce((a, v) => a + v * v, 0) / data.length);
      const now = performance.now();
      const canListen = phaseRef.current === "listening" && !mutedRef.current;
      const rec = recorder.current;
      const threshold = Math.max(LEVEL_FLOOR, noise * 2.5);
      if (++frame % 6 === 0) setLevel(canListen ? Math.min(1, lvl / (threshold * 3)) : 0);
      if (canListen && lvl > threshold) {
        lastVoice = now;
        if (!rec || rec.state !== "recording") {
          speakingSince = now;
          startRec();
        }
      } else {
        if (canListen && lvl < threshold) noise = noise * 0.98 + lvl * 0.02;
        if (rec?.state === "recording" && (now - lastVoice > SILENCE_MS || !canListen)) rec.stop();
      }
      requestAnimationFrame(tick);
    };
    tick();
  };

  const start = async () => {
    setError(null);
    // Created inside the tap so playback is allowed for the whole call.
    const ac = new AudioContext();
    ctx.current = ac;
    await ac.resume().catch(() => {});
    go("ringing");
    stopRing.current = ring(ac);
    const ringUntil = performance.now() + MIN_RING_MS;
    const fail = (msg: string) => {
      stopRing.current?.();
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(msg);
      go("error");
    };
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      return fail("Microphone access was blocked. Allow it in your browser settings to call.");
    }
    const res = await fetch("/api/call/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: props.conversationId }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      return fail(j.error === "insufficient_sparks" ? `You need at least ✦ ${props.sparksPerMinute} to start a call.` : j.error === "unavailable" ? "Voice calls aren't switched on yet." : "Couldn't connect. Try again.");
    }
    callId.current = j.id;
    setMinutes(1);

    // Character picks up and speaks first.
    const form = new FormData();
    form.append("greet", "1");
    const hello = await turn(form);
    await new Promise((r) => setTimeout(r, Math.max(0, ringUntil - performance.now())));
    stopRing.current?.();
    if (phaseRef.current === "ended") return;
    listen(stream.current!, ac);
    if (hello.ok && hello.j.audio) await say(hello.j.reply, hello.j.audio);
    else go("listening");
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const live = phase === "listening" || phase === "thinking" || phase === "speaking";
  const status =
    phase === "preflight" ? props.city
    : phase === "ringing" ? "Ringing…"
    : phase === "ended" ? `Call ended · ${minutes} min`
    : phase === "error" ? "Call didn't connect"
    : `${mm}:${ss}`;
  const toggleMute = () => {
    mutedRef.current = !muted;
    setMuted(!muted);
  };

  return (
    <main className="relative min-h-[calc(100dvh-56px-64px)] overflow-hidden md:min-h-[calc(100dvh-64px)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_35%_30%,rgba(255,46,126,.22),transparent_60%)]" />
      <div className="relative mx-auto grid max-w-[1100px] gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_360px] md:gap-10 md:px-8 md:py-10">
        {/* Stage: portrait card, name, timer, controls */}
        <section className="flex flex-col items-center gap-5">
          <div className="relative">
            <div
              aria-hidden
              className={clsx("absolute -inset-3 rounded-[34px] transition-all duration-150", phase === "speaking" ? "animate-pulse-soft bg-rani/30 blur-xl" : "bg-rani/10 blur-2xl")}
              style={phase === "listening" ? { boxShadow: `0 0 ${12 + level * 50}px ${level * 14}px rgba(255,180,35,${0.15 + level * 0.4})` } : undefined}
            />
            <div className="relative aspect-[3/4] w-[min(72vw,340px)] overflow-hidden rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,.55)]" style={{ background: props.wash }}>
              {props.portrait && (
                // eslint-disable-next-line @next/next/no-img-element -- public portrait
                <img src={props.portrait} alt={`${props.name}, AI character`} className="size-full object-cover" />
              )}
              {phase === "ringing" && <div className="absolute inset-0 animate-pulse bg-black/25" />}
              <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md">AI · voice call</span>
            </div>
          </div>

          <div className="text-center">
            <h1 className="font-display text-4xl leading-tight">
              {props.name}
              {props.age && <span className="font-light text-ink-2"> {props.age}</span>}
            </h1>
            <p className="mt-1 font-mono text-sm text-ink-2" aria-live="polite">
              {status}
              {phase === "thinking" && " · thinking…"}
              {phase === "speaking" && " · speaking"}
              {phase === "listening" && (muted ? " · muted" : " · listening")}
            </p>
          </div>

          {live || phase === "ringing" ? (
            <div className="flex items-center gap-5">
              <Link href={`/app/chat/${props.conversationId}`} onClick={() => hangUp()} aria-label="End call and go to chat" className="flex size-16 items-center justify-center rounded-full bg-elevated hover:bg-white/10">
                <MessageCircle className="size-6" />
              </Link>
              <button type="button" aria-label="End call" onClick={() => hangUp()} className="flex size-[72px] items-center justify-center rounded-full bg-sindoor text-white shadow-[0_10px_30px_rgba(220,38,38,.4)]">
                <PhoneOff className="size-7" />
              </button>
              <button type="button" aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute} className={clsx("flex size-16 items-center justify-center rounded-full", muted ? "bg-white text-bg" : "bg-elevated hover:bg-white/10")}>
                {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              </button>
            </div>
          ) : phase === "ended" ? (
            <div className="flex gap-3">
              <button type="button" onClick={() => location.reload()} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1DB954] px-6 text-sm font-semibold text-white">
                <Phone className="size-4" /> Call again
              </button>
              <Link href={`/app/chat/${props.conversationId}`} className="inline-flex h-12 items-center rounded-full bg-elevated px-6 text-sm font-semibold">Back to chat</Link>
            </div>
          ) : (
            props.available && (
              <button
                type="button"
                onClick={start}
                disabled={props.balance < props.sparksPerMinute}
                className="inline-flex h-14 items-center gap-2 rounded-full bg-[#1DB954] px-10 text-base font-semibold text-white shadow-[0_10px_30px_rgba(29,185,84,.35)] disabled:bg-elevated disabled:text-ink-3 disabled:shadow-none"
              >
                <Phone className="size-5" />
                {props.balance < props.sparksPerMinute ? "Not enough Sparks" : `Call ${props.name}`}
              </button>
            )
          )}
          {error && <p role="alert" className="max-w-[360px] text-center text-sm text-[#FF8DA6]">{error}</p>}
        </section>

        {/* Side panel: call details, live captions, options */}
        <aside className="flex min-h-0 flex-col gap-3 md:max-h-[calc(100dvh-140px)]">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Per minute" value={`✦ ${props.sparksPerMinute}`} />
            <Stat label="Charged" value={`${minutes} min`} />
            <Stat label="Balance" value={`✦ ${Math.max(0, props.balance - minutes * props.sparksPerMinute)}`} />
          </div>

          <div className="flex min-h-[180px] flex-1 flex-col overflow-hidden rounded-2xl bg-surface">
            <div className="label-caps border-b border-white/[.06] px-4 py-3 text-[11px] text-ink-3">Live captions</div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite">
              {transcript.length === 0 ? (
                <p className="text-[13px] text-ink-3">{phase === "preflight" ? `Tap Call and ${props.name} will pick up and say hello.` : phase === "ringing" ? "Ringing…" : "Say something…"}</p>
              ) : (
                transcript.map((t, k) => (
                  <p key={k} className={clsx("max-w-[90%] rounded-2xl px-3 py-2 text-[13px] leading-snug", t.role === "user" ? "self-end bg-wine text-ink" : "self-start bg-elevated")}>
                    {t.content}
                  </p>
                ))
              )}
              <div ref={logEnd} />
            </div>
          </div>

          {!props.available ? (
            <p className="rounded-2xl bg-surface p-4 text-sm text-ink-2">Voice calls aren&apos;t switched on yet.</p>
          ) : (
            <ul className="rounded-2xl bg-surface p-4 text-[12px] leading-relaxed text-ink-3">
              <li>• Speak naturally, then pause. {props.name} replies when you stop talking.</li>
              <li>• Use headphones for the clearest call.</li>
              <li>• Your audio is never recorded or stored. {props.name} is an AI character.</li>
            </ul>
          )}
          <Link href={`/app/chat/${props.conversationId}`} onClick={() => live && hangUp()} className="text-center text-sm text-ink-3 hover:text-ink">
            Back to chat
          </Link>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-2 py-3">
      <div className="text-[15px] font-bold text-marigold">{value}</div>
      <div className="text-[10px] text-ink-3">{label}</div>
    </div>
  );
}
