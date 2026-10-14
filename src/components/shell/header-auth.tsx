"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { PrimaryLink } from "../ui";

/** Log in / Create account, or "Open app" once signed in. Client-side so public pages stay static. */
export function HeaderAuth() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (signedIn) {
    return (
      <div className="hidden items-center md:flex">
        <PrimaryLink href="/app/chat" className="!h-[42px] !px-5">Open chats</PrimaryLink>
      </div>
    );
  }
  return (
    <div className={`hidden items-center gap-2.5 md:flex ${signedIn === null ? "invisible" : ""}`}>
      <Link href="?auth=login" scroll={false} className="px-2.5 text-sm text-ink-2 hover:text-ink">Log in</Link>
      <PrimaryLink href="?auth=signup" scroll={false} className="!h-[42px] !px-5">Create free account</PrimaryLink>
    </div>
  );
}
