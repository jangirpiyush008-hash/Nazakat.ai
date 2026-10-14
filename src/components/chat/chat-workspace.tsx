"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Brain, Copy, Flag, RotateCcw, Send, Square, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { ChatEvent, ErrorCode } from "@/app/api/chat/route";
import { MemoryPanel, type Memory } from "./memory-panel";

type Msg = { id: string; role: "user" | "assistant"; content: string; feedback?: number | null; pending?: boolean };
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
            <div className="truncate text-xs text-ink-3">{c.occupation} · {c.city} · Voice &amp; images coming soon</div>
          </div>
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
              {m.role === "assistant" && m.pending && !m.content ? (
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
              {m.role === "assistant" && !m.pending && !m.id.startsWith("reply-") && (
                <div className="flex gap-3 pl-1.5 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
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
            Free chat · {remaining} of {props.dailyLimit} messages left today
          </p>
        </div>
      </section>

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
