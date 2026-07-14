// Синк патчноутов EFT из Steam News API (appid 3932890).
// Дёргается из GitHub Actions (sync-patches.yml): раз в сутки по расписанию + вручную.
// Защита CRON_SECRET. Вставляются только новые gid — русские разборы не затираются.
import { NextResponse } from "next/server";
import { syncSteamPatches } from "@/db/articles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncSteamPatches();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/sync-patches]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json(
      { ok: false, error: err.message ?? String(e), dbError: err.cause?.message ?? null },
      { status: 500 },
    );
  }
}
