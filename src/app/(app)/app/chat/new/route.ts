import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/public-origin";
import { createClient } from "@/lib/supabase/server";

/**
 * Opens (or reuses) the conversation with a companion: /app/chat/new?c=<slug>.
 * Optional &then=call opens the call screen, &then=photo opens the photo sheet.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = publicOrigin(request);
  const slug = searchParams.get("c") ?? "";
  const then = searchParams.get("then");
  const here = `/app/chat/new?c=${encodeURIComponent(slug)}${then ? `&then=${encodeURIComponent(then)}` : ""}`;
  const go = (id: string) =>
    NextResponse.redirect(then === "call" ? `${origin}/app/call/${id}` : then === "photo" ? `${origin}/app/chat/${id}?open=photo` : `${origin}/app/chat/${id}`);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(`${origin}/explore?auth=signup&next=${encodeURIComponent(here)}`);

  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", auth.user.id).single();
  if (!profile?.onboarded_at) return NextResponse.redirect(`${origin}/app/onboarding?next=${encodeURIComponent(here)}`);

  const { data: companion } = await supabase.from("companions").select("id").eq("slug", slug).maybeSingle();
  if (!companion) return NextResponse.redirect(`${origin}/explore`);

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("companion_id", companion.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return go(existing.id);

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ user_id: auth.user.id, companion_id: companion.id })
    .select("id")
    .single();
  if (error || !created) return NextResponse.redirect(`${origin}/explore`);
  return go(created.id);
}
