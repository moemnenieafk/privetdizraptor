// Детект изменений крафтов убежища (SPT-дифф, см. detectCraftChanges).
// GitHub Actions (sync-craft-changes.yml): раз в сутки + вручную. Первый прогон = базлайн.
import { NextResponse } from "next/server";
import { detectCraftChanges } from "@/db/game-changes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await detectCraftChanges();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/sync-craft-changes]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json({ ok: false, error: err.message ?? String(e), dbError: err.cause?.message ?? null }, { status: 500 });
  }
}
