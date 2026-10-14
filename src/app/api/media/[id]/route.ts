import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
type Params = Promise<{ id: string }>;

/** Deletes one of the user's generated photos/videos (storage object + record). */
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: media } = await supabase.from("media_assets").select("id, storage_path").eq("id", id).maybeSingle(); // RLS: owner only
  const admin = createAdminClient();
  if (!media || !admin) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await admin.storage.from("generations").remove([media.storage_path]);
  await admin.from("messages").update({ content: "Media deleted" }).eq("media_id", media.id);
  await admin.from("media_assets").delete().eq("id", media.id);
  return NextResponse.json({ ok: true });
}
