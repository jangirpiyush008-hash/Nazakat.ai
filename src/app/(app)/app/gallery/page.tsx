import { createAdminClient } from "@/lib/supabase/admin";
import { requireOnboarded } from "@/server/session";
import { GalleryGrid, type GalleryItem } from "@/components/gallery-grid";

export const metadata = { title: "Gallery" };

export default async function GalleryPage() {
  const { supabase } = await requireOnboarded("/app/gallery");
  const [{ data: media }, { data: companions }] = await Promise.all([
    supabase.from("media_assets").select("id, kind, storage_path, duration_s, prompt, companion_id, created_at").order("created_at", { ascending: false }).limit(120),
    supabase.from("companions").select("id, name"),
  ]);
  const admin = createAdminClient();
  const { data: signed } = media?.length && admin ? await admin.storage.from("generations").createSignedUrls(media.map((m) => m.storage_path), 3600) : { data: [] };
  const names = new Map((companions ?? []).map((c) => [c.id, c.name]));
  const items: GalleryItem[] = (media ?? []).map((m, i) => ({
    id: m.id,
    kind: m.kind,
    url: signed?.[i]?.signedUrl ?? null,
    duration: m.duration_s,
    prompt: m.prompt,
    companion: names.get(m.companion_id) ?? "",
  }));
  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="font-display text-[36px] font-light">Gallery</h1>
        <p className="text-sm text-ink-3">Your AI-generated photos and videos. Private to you.</p>
      </header>
      <GalleryGrid initial={items} />
    </main>
  );
}
