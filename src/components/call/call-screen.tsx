"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { MessageCircle, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import type { CallEvent } from "@/app/api/call/turn/route";

type Phase = "preflight" | "ringing" | "listening" | "thinking" | "speaking" | "ended" | "error";
type Turn = { role: "user" | "assistant"; content: string };

const SILENCE_MS = 750; // end of a spoken turn
const BARGE_IN_MS = 400; // talk over the character this long to interrupt
const RESUME_TIMEOUT_MS = 800; // iOS can leave AudioContext.resume() pending forever while the mic is on

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms))]);
const MIN_SPEECH_MS = 350;
const MIN_RING_MS = 2400; // let it ring at least once
const LEVEL_FLOOR = 0.008;

/**
 * Voice call: it rings, the character picks up and says hello, then the
 * browser listens, detects when you stop talking and sends that clip. The
 * reply streams back sentence by sentence and plays as it arrives; talking
 * over the character interrupts them, like a real call. Billing is per started minute on the server;
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
  /** Fallback player, unlocked on the Call tap, for browsers where Web Audio decoding fails. */
  const fallback = useRef<HTMLAudioElement | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const tapResolve = useRef<(() => void) | null>(null);
  const stopRing = useRef<(() => void) | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);
  /** Sentences waiting to be spoken, and the turn they belong to (stale turns are dropped). */
  const queue = useRef<{ audio: string; contentType: string; turn: number }[]>([]);
  const draining = useRef(false);
  const streamDone = useRef(true);
  const turnNo = useRef(0);
  const spoken = useRef("");
  /** Call timeline sent with hang-up for debugging (phases, audio state, mic levels — never audio or words). */
  const log = useRef<string[]>([]);
  const t0 = useRef(0);
  const note = (e: string) => {
    if (log.current.length < 400) log.current.push(`${((performance.now() - t0.current) / 1000).toFixed(1)}s ${e}`);
  };
  const phaseSince = useRef(0);

  const go = (p: Phase) => {
    if (phaseRef.current !== p) note(`phase ${p} (audio ${ctx.current?.state ?? "none"})`);
    phaseRef.current = p;
    phaseSince.current = performance.now();
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
    fallback.current?.pause();
    ctx.current?.close().catch(() => {});
    if (callId.current) {
      note(`hangup ${reason ?? "user"}`);
      const r = await fetch("/api/call/end", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId: callId.current, log: log.current }) }).then((x) => x.json()).catch(() => null);
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

  /** If the browser still blocks sound, show a "Tap to hear" button and wait for it. */
  const unblock = () =>
    new Promise<void>((resolve) => {
      tapResolve.current = resolve;
      setNeedsTap(true);
    });

  const play = async (base64: string, contentType = "audio/mpeg") => {
    const ac = ctx.current;
    if (ac) {
      try {
        if (ac.state !== "running") await withTimeout(ac.resume(), RESUME_TIMEOUT_MS);
        if (ac.state !== "running") throw new Error(`audio ${ac.state}`);
        const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
        const buf = await ac.decodeAudioData(bytes.buffer);
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(ac.destination);
        playing.current = src;
        await new Promise<void>((resolve) => {
          src.onended = () => resolve();
          src.start();
          // Never wait on a stuck clip: give up a little after it should have ended.
          setTimeout(resolve, (buf.duration + 1.5) * 1000);
        });
        return;
      } catch (err) {
        note(`webaudio failed: ${(err as Error).message.slice(0, 60)}`);
      }
    }
    const el = fallback.current ?? new Audio();
    fallback.current = el;
    el.src = `data:${contentType};base64,${base64}`;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      el.onended = done;
      el.onerror = done;
      setTimeout(done, 20_000);
      el.play().catch(async () => {
        note("audio element blocked: asking for a tap");
        await unblock();
        el.play().catch(done);
      });
    });
  };

  /** Plays queued sentences in order; back to listening when the reply is finished. */
  const drain = async () => {
    // Held until the ring finishes; start() drains right after.
    if (draining.current || phaseRef.current === "ringing") return;
    draining.current = true;
    while (queue.current.length) {
      const item = queue.current.shift()!;
      if (item.turn !== turnNo.current || phaseRef.current === "ended") continue;
      go("speaking");
      try {
        await play(item.audio, item.contentType);
      } catch {
        /* undecodable audio: the caption is still shown */
      }
    }
    draining.current = false;
    if (streamDone.current && (phaseRef.current === "speaking" || phaseRef.current === "thinking")) finishReply();
  };

  const finishReply = () => {
    if (spoken.current) history.current.push({ role: "assistant", content: spoken.current });
    spoken.current = "";
    if (phaseRef.current !== "ended") go("listening");
  };

  /** Stops the character mid-sentence (barge-in) and drops the rest of the reply. */
  const interrupt = () => {
    turnNo.current++;
    queue.current = [];
    try {
      playing.current?.stop();
    } catch {}
    fallback.current?.pause();
    streamDone.current = true;
    finishReply();
  };

  /** Sends a turn and streams the reply: transcript, then audio per sentence. */
  const turn = async (form: FormData) => {
    const my = ++turnNo.current;
    form.append("callId", callId.current!);
    form.append("history", JSON.stringify(history.current.slice(-12)));
    streamDone.current = false;
    spoken.current = "";
    const res = await fetch("/api/call/turn", { method: "POST", body: form }).catch(() => null);
    if (!res || !res.ok || !res.body || (res.headers.get("content-type") ?? "").includes("application/json")) {
      const j = res ? await res.json().catch(() => ({})) : { error: "network" };
      streamDone.current = true;
      if (j.minutes) setMinutes(j.minutes);
      return { ok: Boolean(res?.ok), j };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let bubble = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (done || my !== turnNo.current) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line) as CallEvent;
        if (ev.t === "heard") {
          if (ev.minutes) setMinutes(ev.minutes);
          if (ev.text) {
            history.current.push({ role: "user", content: ev.text });
            setTranscript((t) => [...t, { role: "user", content: ev.text }]);
          }
        } else if (ev.t === "audio") {
          spoken.current = `${spoken.current} ${ev.text}`.trim();
          const text = spoken.current;
          setTranscript((t) => (bubble ? [...t.slice(0, -1), { role: "assistant", content: text }] : [...t, { role: "assistant", content: text }]));
          bubble = true;
          queue.current.push({ audio: ev.audio, contentType: ev.contentType, turn: my });
          void drain();
        } else if (ev.t === "error" && !bubble) {
          setTranscript((t) => [...t, { role: "assistant", content: "Sorry, I didn't catch that. Say it again?" }]);
        }
      }
    }
    if (my === turnNo.current) {
      streamDone.current = true;
      if (!draining.current && !queue.current.length && phaseRef.current !== "ended") finishReply();
    }
    return { ok: true, j: {} as Record<string, unknown> };
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
      setTranscript((t) => [...t, { role: "assistant", content: "Sorry, I didn't catch that. Say it again?" }]);
      return go("listening");
    }
    if (j.empty) go("listening");
  };

  const listen = (s: MediaStream, ac: AudioContext) => {
    note(`listen: track ${s.getAudioTracks()[0]?.readyState} ${s.getAudioTracks()[0]?.label?.slice(0, 30) ?? ""}`);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    ac.createMediaStreamSource(s).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let speakingSince = 0;
    let lastVoice = 0;
    let noise = 0.01; // running estimate of room noise
    let frame = 0;
    let bargeSince = 0;
    let peak = 0;
    let lastReport = performance.now();

    const startRec = () => {
      chunks.current = [];
      const mime = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        const dur = lastVoice - speakingSince;
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || "audio/webm" });
        note(`rec stop ${Math.round(dur)}ms ${blob.size}B`);
        if (dur >= MIN_SPEECH_MS && phaseRef.current === "listening") sendTurn(blob);
      };
      rec.start();
      recorder.current = rec;
      note(`rec start ${rec.mimeType || mime}`);
    };

    const tick = () => {
      if (phaseRef.current === "ended") return;
      analyser.getFloatTimeDomainData(data);
      const lvl = Math.sqrt(data.reduce((a, v) => a + v * v, 0) / data.length);
      const now = performance.now();
      const canListen = phaseRef.current === "listening" && !mutedRef.current;
      const rec = recorder.current;
      const threshold = Math.max(LEVEL_FLOOR, noise * 2.5);
      peak = Math.max(peak, lvl);
      if (now - lastReport > 3000) {
        note(`mic peak ${peak.toFixed(3)} thr ${threshold.toFixed(3)} ${phaseRef.current}`);
        peak = 0;
        lastReport = now;
        // Watchdog: never stay stuck waiting on the character.
        const stuck = now - phaseSince.current;
        if ((phaseRef.current === "speaking" && stuck > 30_000) || (phaseRef.current === "thinking" && stuck > 25_000)) {
          note("watchdog: back to listening");
          interrupt();
        }
      }
      // Barge-in: clearly talking over the character (well above echo level) stops them.
      if (phaseRef.current === "speaking" && !mutedRef.current && lvl > threshold * 4) {
        if (!bargeSince) bargeSince = now;
        else if (now - bargeSince > BARGE_IN_MS) {
          bargeSince = 0;
          note("barge-in");
          interrupt();
        }
      } else bargeSince = 0;
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
    t0.current = performance.now();
    log.current = [];
    // Created inside the tap so playback is allowed for the whole call.
    const ac = new AudioContext();
    ctx.current = ac;
    // Unlock the fallback player inside the tap too (iOS needs a gesture once).
    const el = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=");
    el.play().catch(() => {});
    fallback.current = el;
    await withTimeout(ac.resume().catch(() => {}), RESUME_TIMEOUT_MS);
    note(`start: audio ${ac.state}, ${navigator.userAgent.slice(0, 80)}`);
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
    // The hello is fetched while it rings, so the character speaks as soon as they pick up.
    const form = new FormData();
    form.append("greet", "1");
    const hello = turn(form);
    await new Promise((r) => setTimeout(r, Math.max(0, ringUntil - performance.now())));
    stopRing.current?.();
    if (phaseRef.current === "ended") return;
    go("thinking");
    listen(stream.current!, ac);
    void drain();
    if (!(await hello).ok) go("listening");
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

          {needsTap && (
            <button
              type="button"
              onClick={() => {
                ctx.current?.resume().catch(() => {});
                setNeedsTap(false);
                tapResolve.current?.();
              }}
              className="bg-saanjh h-12 rounded-full px-6 text-sm font-semibold text-white shadow-glow"
            >
              🔊 Tap to hear {props.name}
            </button>
          )}
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
