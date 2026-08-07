// GET/DELETE /api/eft/checkpoints/[slot] — один слот текущего юзера (0=авто, 1..3=ручной).
// GET — полный payload для восстановления; DELETE — очистить слот. Юзер строго из сессии;
// WHERE всегда фильтрует по user_id (чужой слот недоступен).
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { questCheckpoints } from "@/db/schema-checkpoints";
import { eftGameId } from "@/db/eft";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function parseSlot(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slot: string }> },
): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const slot = parseSlot((await ctx.params).slot);
  if (slot === null) return NextResponse.json({ error: "bad slot" }, { status: 422 });

  const gameId = await eftGameId();
  const [row] = await db
    .select({ payload: questCheckpoints.payload })
    .from(questCheckpoints)
    .where(
      and(
        eq(questCheckpoints.userId, userId),
        eq(questCheckpoints.gameId, gameId),
        eq(questCheckpoints.slot, slot),
      ),
    )
    .limit(1);

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row.payload);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slot: string }> },
): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const slot = parseSlot((await ctx.params).slot);
  if (slot === null) return NextResponse.json({ error: "bad slot" }, { status: 422 });

  const gameId = await eftGameId();
  await db
    .delete(questCheckpoints)
    .where(
      and(
        eq(questCheckpoints.userId, userId),
        eq(questCheckpoints.gameId, gameId),
        eq(questCheckpoints.slot, slot),
      ),
    );

  return NextResponse.json({ ok: true });
}
