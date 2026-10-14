"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Brain, Camera, Clapperboard, Copy, Flag, Phone, RotateCcw, Send, Square, ThumbsDown, ThumbsUp, Volume2, X } from "lucide-react";
import { sparkCosts, type VideoDuration } from "@/config/pricing";
import { createClient } from "@/lib/supabase/browser";
import type { ChatEvent, ErrorCode } from "@/app/api/chat/route";
import { MemoryPanel, type Memory } from "./memory-panel";
import { MediaSheet } from "./media-sheet";

export type MediaRef = { id: string; kind: "image" | "video"; url: string | null; duration: number | null };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  feedback?: number | null;
  pending?: boolean;
  media?: MediaRef | null;
  /** In-progress photo/video generation shown as a placeholder bubble. */
  job?: { id: string; kind: "image" | "video"; duration?: number; error?: string };
};
type Companion = { id: string; slug: string; name: string; age: number; city: string; occupation: string; hook: string; wash: string };

const errorCopy: Record<ErrorCode | "network", string> = {
  unavailable: "Chat isn't switched on yet. Your message wasn't sent.",
  limit: "You've used today's free messages. They reset at midnight IST.",
  refused: "That reply couldn't be generated. Try saying it a different way.",
  timeout: "That took too long. Try again.",
  failed: "Something went wrong on our side. Try again.",
  network: "You're offline or the connection dropped. Try again.",
};

const starters = ["How was your day?", "Tell me something about yourself", "I can't sleep tonight"];

export function ChatWorkspace(props: {
  conversationId: string;
  companion: Companion;
  initialMessages: Msg[];
  initialMemories: Memory[];
  memoryEnabled: boolean;
  chatAvailable: boolean;
  features: { image: boolean; video: boolean; voice: boolean; voiceNotes: boolean };
  balance: number;
  videoDurations: VideoDuration[];
  remaining: number;
  dailyLimit: number;
}) {
  const { companion: c } = props;
  const [messages, setMessages] = useState<Msg[]>(props.initialMessages);
  const [memories, setMemories] = useState<Memory[]>(props.initialMemories);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ErrorCode | "network" | null>(null);
  const [remaining, setRemaining] = useState(props.remaining);
  const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [sheet, setSheet] = useState<"image" | "video" | null>(null);
  const [balance, setBalance] = useState(props.balance);
  const [voiceLoading, setVoiceLoading] = useState<string | null>(null);
  const voiceCache = useRef(new Map<string, string>());

  const playVoice = async (id: string) => {
    let url = voiceCache.current.get(id);
    if (!url) {
      setVoiceLoading(id);
      const r = await fetch("/api/voice-note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: id }) });
      const j = await r.json().catch(() => ({}));
      setVoiceLoading(null);
      if (!r.ok || !j.url) {
        setToast(j.error === "insufficient_sparks" ? "Not enough Sparks for a voice note." : "Couldn't make that voice note. Sparks refunded.");
        return;
      }
      if (j.cost) setBalance((b) => Math.max(0, b - j.cost));
      url = j.url as string;
      voiceCache.current.set(id, url);
    }
    new Audio(url).play().catch(() => {});
  };
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const run = async (payload: { text?: string; retry?: boolean }) => {
    setError(null);
    setStreaming(true);
    const tempUser = payload.text ? { id: `tmp-${Date.now()}`, role: "user" as const, content: payload.text, pending: true } : null;
    const tempReply: Msg = { id: `reply-${Date.now()}`, role: "assistant", content: "", pending: true };
    setMessages((m) => [...m, ...(tempUser ? [tempUser] : []), tempReply]);

    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: props.conversationId, ...payload }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const { error: code } = await res.json().catch(() => ({ error: "failed" }));
        setMessages((m) => m.filter((x) => x.id !== tempReply.id && x.id !== tempUser?.id));
        if (tempUser && code !== "limit" && code !== "unavailable") setInput(payload.text ?? "");
        setError((code as ErrorCode) in errorCopy ? (code as ErrorCode) : "failed");
        if (code === "limit") setRemaining(0);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as ChatEvent;
          if (ev.t === "user" && tempUser) setMessages((m) => m.map((x) => (x.id === tempUser.id ? { ...x, id: ev.id, pending: false } : x)));
          else if (ev.t === "delta") setMessages((m) => m.map((x) => (x.id === tempReply.id ? { ...x, content: x.content + ev.text } : x)));
          else if (ev.t === "done") {
            setMessages((m) => m.map((x) => (x.id === tempReply.id ? { ...x, id: ev.id || x.id, pending: false } : x)));
            if (ev.remaining !== null) setRemaining(ev.remaining);
          } else if (ev.t === "memory") {
            setMemories((mm) => [...ev.items.map((i) => ({ ...i, created_at: new Date().toISOString() })), ...mm]);
            setToast(`Memory saved: “${ev.items[0].fact}”`);
          } else if (ev.t === "error") {
            setMessages((m) => m.filter((x) => x.id !== tempReply.id));
            setError(ev.code);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMessages((m) => m.map((x) => (x.id === tempReply.id ? { ...x, pending: false } : x)).filter((x) => x.id !== tempReply.id || x.content));
      } else {
        setMessages((m) => m.filter((x) => x.id !== tempReply.id));
        setError("network");
      }
    } finally {
      setStreaming(false);
      abort.current = null;
      inputRef.current?.focus();
    }
  };

  const send = (text = input) => {
    const t = text.trim();
    if (!t || streaming) return;
    setInput("");
    run({ text: t });
  };

  const pollJob = async (jobId: string, placeholderId: string) => {
    for (let i = 0; i < 120; i++) {
      await new Promise((res) => setTimeout(res, i < 5 ? 2500 : 5000));
      const r = await fetch(`/api/generate/${jobId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (!r || r.status === "running" || r.status === "queued" || r.status === "finishing") continue;
      if (r.status === "succeeded" && r.media) {
        setMessages((m) => m.map((x) => (x.id === placeholderId ? { ...x, id: `media-${r.media.id}`, job: undefined, pending: false, media: r.media } : x)));
      } else {
        if (r.refunded) setBalance((b) => b + r.refunded);
        const why = r.status === "blocked" ? "That one didn't pass our safety check. Sparks refunded." : "Generation failed. Sparks refunded.";
        setMessages((m) => m.map((x) => (x.id === placeholderId ? { ...x, job: x.job && { ...x.job, error: why } } : x)));
      }
      return;
    }
  };

  const createMedia = async (kind: "image" | "video", prompt: string, duration?: VideoDuration) => {
    setSheet(null);
    const placeholderId = `job-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: `req-${Date.now()}`, role: "user", content: `${kind === "image" ? "📷" : "🎬"} ${prompt}` },
      { id: placeholderId, role: "assistant", content: "", job: { id: "", kind, duration } },
    ]);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: props.conversationId, kind, prompt, duration }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const why =
        j.error === "blocked"
          ? j.reason === "minor"
            ? "Can't create that — anything involving minors is blocked."
            : j.reason === "explicit"
              ? "Can't create that — nudity and explicit content are blocked. Try something flirty instead."
              : j.reason === "real_person"
                ? "Can't create images of real people."
                : "That request was blocked by our safety check."
          : j.error === "insufficient_sparks"
            ? "Not enough Sparks."
            : j.error === "unavailable"
              ? "Photos and videos aren't switched on yet."
              : "Couldn't start that. Try again.";
      setMessages((m) => m.map((x) => (x.id === placeholderId ? { ...x, job: x.job && { ...x.job, error: why } } : x)));
      return;
    }
    setBalance((b) => Math.max(0, b - (j.cost ?? 0)));
    setMessages((m) => m.map((x) => (x.id === placeholderId ? { ...x, job: x.job && { ...x.job, id: j.id } } : x)));
    pollJob(j.id, placeholderId);
  };

  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";
  const disabled = !props.chatAvailable || remaining <= 0;

  const feedback = async (id: string, value: 1 | -1) => {
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, feedback: value } : x)));
    await createClient().from("messages").update({ feedback: value }).eq("id", id);
  };

  const report = async (id: string) => {
    const { data } = await createClient().auth.getUser();
    if (!data.user) return;
    const { error } = await createClient().from("reports").insert({ reporter_id: data.user.id, target_type: "message", target_id: id, reason: "user_report" });
    setToast(error ? "Couldn't send the report. Try again." : "Reported. Our team will review it.");
  };

  return (
    <div className="grid h-[calc(100dvh-56px-64px)] md:h-[calc(100dvh-64px)] lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="relative flex min-h-0 flex-col overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30 blur-[40px]" style={{ background: c.wash }} />

        {/* Header */}
        <div className="glass relative z-10 flex items-center gap-3 border-x-0 border-t-0 px-4 py-3">
          <Link href="/app/chat" aria-label="Back to chats" className="flex size-9 items-center justify-center rounded-full hover:bg-white/10 md:hidden">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="size-10 flex-none rounded-full shadow-[0_0_0_2px_#FFB423]" style={{ background: c.wash }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link href={`/companions/${c.slug}`} className="font-semibold hover:underline">{c.name}</Link>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">AI</span>
            </div>
            <div className="truncate text-xs text-ink-3">{c.occupation} · {c.city}</div>
          </div>
          {props.features.voice && (
            <Link href={`/app/call/${props.conversationId}`} className="glass inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold">
              <Phone className="size-4 text-marigold" /> Call · ✦{sparkCosts.voicePerMinute}/min
            </Link>
          )}
          <button type="button" onClick={() => setPanel(true)} className="glass inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold lg:hidden">
            <Brain className="size-4 text-violet" /> Memory
          </button>
        </div>

        {/* Messages */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5" aria-live="polite">
          <p className="mx-auto rounded-full bg-elevated/80 px-3 py-1.5 text-center text-[11px] text-ink-3">
            {c.name} is an AI character. Conversations are private to you.
          </p>

          {messages.length === 0 && (
            <div className="mx-auto mt-10 flex max-w-[360px] flex-col items-center gap-3 text-center">
              <span className="size-20 rounded-full shadow-[0_0_40px_rgba(255,46,126,.35)]" style={{ background: c.wash }} />
              <h2 className="font-display text-2xl">{c.name} is waiting</h2>
              <p className="font-display text-[15px] italic text-ink-2">“{c.hook}”</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {starters.map((s) => (
                  <button key={s} type="button" disabled={disabled} onClick={() => send(s)} className="glass rounded-full px-3.5 py-2 text-[13px] disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={clsx("group flex max-w-[82%] flex-col gap-1 md:max-w-[68%]", m.role === "user" ? "self-end items-end" : "self-start")}>
              {m.job ? (
                <div className="flex w-[240px] flex-col gap-2 rounded-[20px_20px_20px_4px] bg-elevated p-4 text-[13px] text-ink-2">
                  {m.job.error ? (
                    <span>{m.job.error}</span>
                  ) : (
                    <>
                      <span>{m.job.kind === "image" ? `${c.name} is getting ready for a photo…` : `${c.name} is filming a ${m.job.duration}s clip…`}</span>
                      <span className="relative h-2 overflow-hidden rounded-full bg-surface">
                        <span className="bg-saanjh animate-pulse-soft absolute inset-y-0 left-0 w-2/3 rounded-full" />
                      </span>
                      <span className="text-[11px] text-ink-3">{m.job.kind === "image" ? "Usually 10–30 seconds" : "Usually 1–4 minutes"} · refunded if it fails</span>
                    </>
                  )}
                </div>
              ) : m.media ? (
                <figure className="overflow-hidden rounded-[20px_20px_20px_4px] bg-elevated">
                  {!m.media.url ? (
                    <div className="p-4 text-[13px] text-ink-3">Media unavailable</div>
                  ) : m.media.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
                    <img src={m.media.url} alt={`AI-generated photo of ${c.name}`} className="max-h-[420px] w-[260px] object-cover md:w-[300px]" />
                  ) : (
                    <video src={m.media.url} controls playsInline className="max-h-[480px] w-[260px] md:w-[300px]" />
                  )}
                  <figcaption className="px-3 py-1.5 text-[11px] text-ink-3">AI-generated · private to you</figcaption>
                </figure>
              ) : m.role === "assistant" && m.pending && !m.content ? (
                <div className="flex items-center gap-2 rounded-[20px_20px_20px_4px] bg-elevated px-4 py-3" aria-label={`${c.name} is typing`}>
                  {[0, 0.2, 0.4].map((d) => (
                    <span key={d} className="animate-pulse-soft size-1.5 rounded-full bg-rani" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              ) : (
                <div
                  className={clsx(
                    "whitespace-pre-wrap px-4 py-3 text-[15px] leading-relaxed",
                    m.role === "user" ? "bg-saanjh rounded-[20px_20px_4px_20px] text-white shadow-[0_8px_24px_rgba(255,46,126,.25)]" : "rounded-[20px_20px_20px_4px] bg-elevated",
                    m.pending && m.role === "user" && "opacity-70",
                  )}
                >
                  {m.content}
                </div>
              )}
              {m.role === "assistant" && !m.pending && !m.job && !/^(reply|media|job)-/.test(m.id) && (
                <div className="flex gap-3 pl-1.5 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
                  {props.features.voiceNotes && (
                    <button
                      type="button"
                      aria-label={`Hear this as a voice note (${sparkCosts.voiceNote} Sparks, replays free)`}
                      onClick={() => playVoice(m.id)}
                      disabled={voiceLoading === m.id}
                      className="inline-flex items-center gap-1 text-marigold hover:text-ink disabled:opacity-50"
                    >
                      <Volume2 className="size-3.5" />
                      {voiceLoading === m.id ? "…" : voiceCache.current.has(m.id) ? "" : `✦${sparkCosts.voiceNote}`}
                    </button>
                  )}
                  <button type="button" aria-label="Copy" onClick={() => navigator.clipboard.writeText(m.content)} className="hover:text-ink"><Copy className="size-3.5" /></button>
                  <button type="button" aria-label="Good reply" aria-pressed={m.feedback === 1} onClick={() => feedback(m.id, 1)} className={clsx("hover:text-ink", m.feedback === 1 && "text-marigold")}><ThumbsUp className="size-3.5" /></button>
                  <button type="button" aria-label="Bad reply" aria-pressed={m.feedback === -1} onClick={() => feedback(m.id, -1)} className={clsx("hover:text-ink", m.feedback === -1 && "text-rani")}><ThumbsDown className="size-3.5" /></button>
                  <button type="button" aria-label="Report" onClick={() => report(m.id)} className="hover:text-ink"><Flag className="size-3.5" /></button>
                </div>
              )}
            </div>
          ))}

          {error && (
            <div role="alert" className="mx-auto flex max-w-[420px] items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-[13px] text-ink-2">
              <span className="size-2 flex-none rounded-full bg-marigold" />
              <span className="flex-1">{errorCopy[error]}</span>
              {lastIsUser && error !== "limit" && error !== "unavailable" && (
                <button type="button" onClick={() => run({ retry: true })} className="inline-flex items-center gap-1 font-semibold text-rani">
                  <RotateCcw className="size-3.5" /> Retry
                </button>
              )}
              {error === "limit" && <Link href="/pricing" className="font-semibold text-rani">See plans</Link>}
            </div>
          )}
          <div ref={bottom} />
        </div>

        {/* Composer */}
        <div className="relative z-10 px-3 pb-3 pt-1 md:px-6 md:pb-5">
          {toast && (
            <div role="status" className="mx-auto mb-2 w-fit max-w-full truncate rounded-full bg-marigold px-4 py-2 text-[13px] font-semibold text-on-gold">
              ✓ {toast}
              {toast.startsWith("Memory") && (
                <button type="button" onClick={() => setPanel(true)} className="ml-2 underline lg:hidden">Edit</button>
              )}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="glass flex items-end gap-2 rounded-[26px] p-1.5 pl-4"
          >
            {(props.features.image || props.features.video) && (
              <div className="flex flex-none items-center gap-1 self-center">
                {props.features.image && (
                  <button type="button" onClick={() => setSheet("image")} aria-label={`Ask ${c.name} for a photo · ${sparkCosts.image} Sparks`} className="flex size-9 items-center justify-center rounded-full text-marigold hover:bg-white/10">
                    <Camera className="size-[18px]" />
                  </button>
                )}
                {props.features.video && (
                  <button type="button" onClick={() => setSheet("video")} aria-label={`Ask ${c.name} for a video`} className="flex size-9 items-center justify-center rounded-full text-marigold hover:bg-white/10">
                    <Clapperboard className="size-[18px]" />
                  </button>
                )}
              </div>
            )}
            <label htmlFor="composer" className="sr-only">Message {c.name}</label>
            <textarea
              ref={inputRef}
              id="composer"
              rows={1}
              value={input}
              maxLength={2000}
              disabled={disabled}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={!props.chatAvailable ? "Chat opens soon" : remaining <= 0 ? "Daily free messages used" : `Message ${c.name}…`}
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
            />
            {streaming ? (
              <button type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="flex size-11 flex-none items-center justify-center rounded-full bg-elevated">
                <Square className="size-4 fill-current" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim() || disabled} aria-label="Send" className="bg-saanjh flex size-11 flex-none items-center justify-center rounded-full text-white disabled:opacity-40">
                <Send className="size-[18px]" />
              </button>
            )}
          </form>
          <p className="mt-2 text-center text-[11px] text-ink-3">
            Free chat · {remaining} of {props.dailyLimit} messages left today · <Link href="/app/wallet" className="text-marigold">✦ {balance}</Link>
          </p>
        </div>
      </section>

      {sheet && (
        <MediaSheet kind={sheet} name={c.name} balance={balance} durations={props.videoDurations} onClose={() => setSheet(null)} onCreate={(p, d) => createMedia(sheet, p, d)} />
      )}

      {/* Memory panel: side column on desktop, sheet on mobile */}
      <aside className="hidden min-h-0 border-l border-white/[.06] bg-surface lg:block">
        <MemoryPanel companionId={c.id} companionName={c.name} memories={memories} setMemories={setMemories} memoryEnabled={props.memoryEnabled} />
      </aside>
      {panel && (
        <div className="fixed inset-0 z-50 flex items-end bg-bg/70 backdrop-blur-sm lg:hidden" onClick={() => setPanel(false)}>
          <div role="dialog" aria-modal aria-label="Memory" onClick={(e) => e.stopPropagation()} className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-surface">
            <button type="button" onClick={() => setPanel(false)} aria-label="Close" className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full hover:bg-elevated">
              <X className="size-5" />
            </button>
            <MemoryPanel companionId={c.id} companionName={c.name} memories={memories} setMemories={setMemories} memoryEnabled={props.memoryEnabled} />
          </div>
        </div>
      )}
    </div>
  );
}
