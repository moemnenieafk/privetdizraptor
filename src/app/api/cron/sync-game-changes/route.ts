// Детект игровых изменений: сравнивает текущие items+item_properties с прошлым
// снимком и пишет дельты (см. db/game-changes.ts). Дёргается из GitHub Actions
// (sync-game-changes.yml): раз в сутки + вручную. Защита CRON_SECRET.
// Первый прогон = базлайн (сеет снимок, дельты не пишет).
import { NextResponse } from "next/server";
import { detectGameChanges } from "@/db/game-changes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await detectGameChanges();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/sync-game-changes]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json(
      { ok: false, error: err.message ?? String(e), dbError: err.cause?.message ?? null },
      { status: 500 },
    );
  }
}
