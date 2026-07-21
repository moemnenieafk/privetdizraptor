// Разовый бэкфил истории цен по наградам Рефа из tarkov.dev.
// Ручной прогон: /api/cron/backfill-price-history?days=30
// Свои снимки не перезаписывает. Требует применённой миграции колонки `source`.
import { NextResponse } from "next/server";
import { backfillPriceHistory } from "@/db/price-history-backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_DAYS = 90;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = Number(new URL(req.url).searchParams.get("days"));
  const days = Number.isInteger(raw) && raw > 0 && raw <= MAX_DAYS ? raw : 30;

  try {
    const res = await backfillPriceHistory(days);
    return NextResponse.json({ ok: true, requestedDays: days, ...res, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/backfill-price-history]", e);
    const err = e as { message?: string };
    return NextResponse.json({ ok: false, error: err.message ?? String(e) }, { status: 502 });
  }
}
