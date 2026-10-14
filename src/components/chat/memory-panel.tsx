"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/browser";

export type Memory = { id: string; fact: string; category: string; created_at: string };

const accent: Record<string, string> = {
  preference: "border-l-rani",
  place: "border-l-marigold",
  name: "border-l-violet",
  date: "border-l-sunset",
  other: "border-l-ink-3",
};

/** "What Nazakat remembers": every remembered fact, editable and deletable (RLS-scoped to the user). */
export function MemoryPanel({
  companionId,
  companionName,
  memories,
  setMemories,
  memoryEnabled,
}: {
  companionId: string;
  companionName: string;
  memories: Memory[];
  setMemories: React.Dispatch<React.SetStateAction<Memory[]>>;
  memoryEnabled: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const save = async (id: string) => {
    const fact = draft.trim();
    if (fact.length < 2) return;
    const { error } = await createClient().from("memory_items").update({ fact }).eq("id", id);
    if (error) return setErr("Couldn't save. Try again.");
    setMemories((m) => m.map((x) => (x.id === id ? { ...x, fact } : x)));
    setEditing(null);
  };

  const forget = async (id: string) => {
    const { error } = await createClient().from("memory_items").delete().eq("id", id);
    if (error) return setErr("Couldn't delete. Try again.");
    setMemories((m) => m.filter((x) => x.id !== id));
  };

  const add = async () => {
    const fact = adding.trim();
    if (fact.length < 2) return;
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data, error } = await supabase
      .from("memory_items")
      .insert({ user_id: auth.user.id, companion_id: companionId, fact: fact.slice(0, 200) })
      .select("id, fact, category, created_at")
      .single();
    if (error || !data) return setErr("Couldn't add. Try again.");
    setMemories((m) => [data, ...m]);
    setAdding("");
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-display text-2xl">What {companionName} remembers</h2>
        <p className="mt-1 text-xs text-ink-3">Short facts only — never whole conversations. Edit or delete anything.</p>
      </div>
      {!memoryEnabled && (
        <p className="rounded-xl bg-elevated p-3 text-xs text-ink-2">
          Saving new memories is off. <Link href="/app/settings" className="text-rani">Turn it on in Settings</Link>.
        </p>
      )}
      {err && <p role="alert" className="text-xs text-[#FF8DA6]">{err}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex gap-2"
      >
        <label htmlFor="add-memory" className="sr-only">Add a memory</label>
        <input id="add-memory" value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={200} placeholder={`Tell ${companionName} something to remember`} className="h-10 min-w-0 flex-1 rounded-xl bg-bg px-3 text-[13px] outline-none placeholder:text-ink-3 focus:shadow-[0_0_0_1px_#FF2E7E]" />
        <button type="submit" disabled={adding.trim().length < 2} className="rounded-xl bg-elevated px-3 text-[13px] font-semibold disabled:opacity-40">Add</button>
      </form>

      {memories.length === 0 ? (
        <p className="text-[13px] text-ink-3">Nothing yet. As you chat, small things you share — a nickname, your city, your favourite chai — show up here.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {memories.map((m) => (
            <li key={m.id} className={clsx("rounded-[14px] border-l-[3px] bg-elevated p-3", accent[m.category] ?? accent.other)}>
              <div className="label-caps flex justify-between text-[10px] text-ink-3">
                <span>{m.category}</span>
                <span>{new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</span>
              </div>
              {editing === m.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    save(m.id);
                  }}
                  className="mt-1.5 flex gap-2"
                >
                  <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} className="h-9 min-w-0 flex-1 rounded-lg bg-bg px-2 text-sm outline-none focus:shadow-[0_0_0_1px_#FF2E7E]" aria-label="Edit memory" />
                  <button type="submit" className="text-xs font-semibold text-rani">Save</button>
                </form>
              ) : (
                <p className="mt-1 text-sm">{m.fact}</p>
              )}
              <div className="mt-2 flex gap-4 text-xs">
                <button type="button" onClick={() => { setEditing(m.id); setDraft(m.fact); }} className="text-ink-2 hover:text-ink">Edit</button>
                <button type="button" onClick={() => forget(m.id)} className="text-sindoor hover:underline">Forget</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
