// Детект изменений квестов (SPT + tarkov.dev, см. detectQuestChanges).
// GitHub Actions (sync-quest-changes.yml): раз в сутки + вручную. Первый прогон = базлайн.
import { NextResponse } from "next/server";
import { detectQuestChanges } from "@/db/game-changes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await detectQuestChanges();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/sync-quest-changes]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json({ ok: false, error: err.message ?? String(e), dbError: err.cause?.message ?? null }, { status: 500 });
  }
}
