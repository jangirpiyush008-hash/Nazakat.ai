"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Mic, MicOff, PhoneOff } from "lucide-react";

type Phase = "preflight" | "connecting" | "listening" | "thinking" | "speaking" | "ended" | "error";
type Turn = { role: "user" | "assistant"; content: string };

const SILENCE_MS = 1100; // end of a spoken turn
const MIN_SPEECH_MS = 400;
const LEVEL_THRESHOLD = 0.035;

/**
 * Turn-based voice call: the browser listens, detects when you stop talking,
 * sends that clip, then plays the companion's spoken reply. Billing is per
 * started minute on the server; audio is never stored.
 */
export function CallScreen(props: { conversationId: string; name: string; wash: string; city: string; available: boolean; sparksPerMinute: number; balance: number }) {
  const [phase, setPhase] = useState<Phase>("preflight");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [caption, setCaption] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const callId = useRef<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const history = useRef<Turn[]>([]);
  const phaseRef = useRef<Phase>("preflight");
  const mutedRef = useRef(false);
  const audioEl = useRef<HTMLAudioElement | null>(null);

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const hangUp = useCallback(async (reason?: string) => {
    if (phaseRef.current === "ended") return;
    go("ended");
    if (reason) setError(reason);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    ctx.current?.close().catch(() => {});
    audioEl.current?.pause();
    if (callId.current) {
      const r = await fetch("/api/call/end", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId: callId.current }) }).then((x) => x.json()).catch(() => null);
      if (r?.minutes) setMinutes(r.minutes);
    }
  }, []);

  useEffect(() => () => void hangUp(), [hangUp]);

  useEffect(() => {
    if (phase === "preflight" || phase === "ended" || phase === "error" || phase === "connecting") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const sendTurn = async (blob: Blob) => {
    go("thinking");
    const form = new FormData();
    form.append("callId", callId.current!);
    form.append("audio", blob, blob.type.includes("ogg") ? "turn.ogg" : blob.type.includes("mp4") ? "turn.m4a" : "turn.webm");
    form.append("history", JSON.stringify(history.current.slice(-12)));
    const res = await fetch("/api/call/turn", { method: "POST", body: form }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : { error: "network" };
    if (j.minutes) setMinutes(j.minutes);
    if (!res || !res.ok) {
      if (j.error === "insufficient_sparks") return hangUp("You're out of Sparks, so the call ended.");
      if (j.error === "ended") return hangUp();
      setCaption(j.error === "refused" ? "Let's talk about something else." : "Sorry, I didn't catch that — say it again?");
      return go("listening");
    }
    if (j.empty) return go("listening");
    history.current.push({ role: "user", content: j.heard }, { role: "assistant", content: j.reply });
    setCaption(j.reply);
    go("speaking");
    const audio = new Audio(`data:${j.contentType || "audio/mpeg"};base64,${j.audio}`);
    audioEl.current = audio;
    audio.onended = () => phaseRef.current === "speaking" && go("listening");
    audio.play().catch(() => go("listening"));
  };

  const listen = (s: MediaStream) => {
    const ac = new AudioContext();
    ctx.current = ac;
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    ac.createMediaStreamSource(s).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let speakingSince = 0;
    let lastVoice = 0;

    const startRec = () => {
      chunks.current = [];
      const mime = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
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
      const level = Math.sqrt(data.reduce((a, v) => a + v * v, 0) / data.length);
      const now = performance.now();
      const canListen = phaseRef.current === "listening" && !mutedRef.current;
      const rec = recorder.current;
      if (canListen && level > LEVEL_THRESHOLD) {
        lastVoice = now;
        if (!rec || rec.state !== "recording") {
          speakingSince = now;
          startRec();
        }
      } else if (rec?.state === "recording" && (now - lastVoice > SILENCE_MS || !canListen)) {
        rec.stop();
      }
      requestAnimationFrame(tick);
    };
    tick();
  };

  const start = async () => {
    setError(null);
    go("connecting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const res = await fetch("/api/call/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: props.conversationId }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        s.getTracks().forEach((t) => t.stop());
        setError(j.error === "insufficient_sparks" ? `You need at least ✦ ${props.sparksPerMinute} to start a call.` : j.error === "unavailable" ? "Voice calls aren't switched on yet." : "Couldn't connect. Try again.");
        return go("error");
      }
      callId.current = j.id;
      setMinutes(1);
      setCaption(`Say hi to ${props.name}…`);
      go("listening");
      listen(s);
    } catch {
      setError("Microphone access was blocked. Allow it in your browser settings to call.");
      go("error");
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const live = phase === "listening" || phase === "thinking" || phase === "speaking";

  return (
    <main className="relative flex min-h-[calc(100dvh-56px-64px)] flex-col items-center justify-between overflow-hidden px-6 py-10 md:min-h-[calc(100dvh-64px)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 blur-[60px]" style={{ background: props.wash }} />
      <div className="relative flex flex-col items-center gap-2 text-center">
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold">AI character · voice call</span>
        <h1 className="font-display text-4xl font-light">{props.name}</h1>
        <p className="text-sm text-ink-2" aria-live="polite">
          {phase === "preflight" && props.city}
          {phase === "connecting" && "Connecting…"}
          {live && `${mm}:${ss} · ✦ ${props.sparksPerMinute}/min · ${minutes} min charged`}
          {phase === "ended" && `Call ended · ${minutes} min · ✦ ${minutes * props.sparksPerMinute}`}
        </p>
      </div>

      <div className="relative flex flex-col items-center gap-6">
        <span
          className={clsx("size-44 rounded-full transition-shadow", phase === "speaking" ? "shadow-[0_0_0_10px_rgba(255,46,126,.25),0_0_80px_rgba(255,46,126,.5)]" : "shadow-[0_0_40px_rgba(255,46,126,.25)]")}
          style={{ background: props.wash }}
        />
        <p className="min-h-12 max-w-[420px] text-center font-display text-lg italic" aria-live="polite">
          {phase === "listening" && (muted ? "You're muted" : caption)}
          {phase === "thinking" && `${props.name} is thinking…`}
          {phase === "speaking" && caption}
        </p>
      </div>

      <div className="relative flex w-full max-w-[420px] flex-col items-center gap-4">
        {phase === "preflight" || phase === "error" ? (
          <>
            {!props.available ? (
              <p className="rounded-2xl bg-surface p-4 text-center text-sm text-ink-2">Voice calls aren&apos;t switched on yet.</p>
            ) : (
              <>
                <ul className="w-full rounded-2xl bg-surface p-4 text-[13px] leading-relaxed text-ink-2">
                  <li>• ✦ {props.sparksPerMinute} per started minute · your balance ✦ {props.balance}</li>
                  <li>• Your microphone is used only during the call. Audio isn&apos;t recorded or stored.</li>
                  <li>• {props.name} is an AI character, not a real person.</li>
                </ul>
                {error && <p role="alert" className="text-center text-sm text-[#FF8DA6]">{error}</p>}
                <button
                  type="button"
                  onClick={start}
                  disabled={props.balance < props.sparksPerMinute}
                  className="bg-saanjh h-14 w-full rounded-[14px] text-base font-semibold text-white shadow-glow disabled:bg-none disabled:bg-elevated disabled:text-ink-3 disabled:shadow-none"
                >
                  {props.balance < props.sparksPerMinute ? "Not enough Sparks" : `Start call · ✦ ${props.sparksPerMinute}/min`}
                </button>
              </>
            )}
            <Link href={`/app/chat/${props.conversationId}`} className="text-sm text-ink-3">Back to chat</Link>
          </>
        ) : phase === "ended" ? (
          <>
            {error && <p role="alert" className="text-center text-sm text-[#FF8DA6]">{error}</p>}
            <Link href={`/app/chat/${props.conversationId}`} className="bg-saanjh inline-flex h-12 items-center rounded-[14px] px-6 text-sm font-semibold text-white">Back to chat</Link>
          </>
        ) : (
          <div className="flex items-center gap-8">
            <button
              type="button"
              aria-pressed={muted}
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => {
                mutedRef.current = !muted;
                setMuted(!muted);
              }}
              className="glass flex size-16 items-center justify-center rounded-full"
            >
              {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </button>
            <button type="button" aria-label="End call" onClick={() => hangUp()} className="flex size-16 items-center justify-center rounded-full bg-sindoor text-white">
              <PhoneOff className="size-6" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
