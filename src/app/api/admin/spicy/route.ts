import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { spicyCreate, spicyModels, spicyStatus } from "@/server/media/spicy";

export const runtime = "nodejs";

/**
 * Operator-only proxy for catalogue work (scripts/gen-portraits.ts): lets the
 * script run SpicyAPI tasks with the server's key, so the key never leaves the
 * server. Authorised by the Supabase service-role key; only our own models.
 */
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), model: z.string(), input: z.record(z.string(), z.unknown()), idempotencyKey: z.string().uuid() }),
  z.object({ action: z.literal("status"), taskId: z.string().min(4).max(120) }),
]);

function authorised(request: NextRequest) {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const got = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    if (parsed.data.action === "status") return NextResponse.json(await spicyStatus(parsed.data.taskId));
    const allowed = [spicyModels.textToImage(), spicyModels.faceEdit()];
    if (!allowed.includes(parsed.data.model)) return NextResponse.json({ error: "model_not_allowed" }, { status: 400 });
    return NextResponse.json(await spicyCreate(parsed.data.model, parsed.data.input, parsed.data.idempotencyKey));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message.slice(0, 200) }, { status: 502 });
  }
}
