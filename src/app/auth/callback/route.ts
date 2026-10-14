import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/public-origin";
import { safeNext } from "@/lib/safe-next";

/** OAuth + email magic-link landing: exchanges the code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = publicOrigin(request);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/app/onboarding?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.redirect(`${origin}/explore?auth=login&error=link`);
}

