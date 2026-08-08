// Cron: детект новых внутриигровых событий EFT + пинг (раздел «События» — ручная хроника,
// авто-запись невозможна). Логика — src/lib/eft-events-detect.ts. Защита — CRON_SECRET (Bearer).
// Расписание — GitHub Actions (Vercel Hobby: лимит крон-джоб уже занят sync-prices/detect-anomalies).
import { NextResponse } from "next/server";
import { detectNewEvents } from "@/lib/eft-events-detect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // макс. для Hobby-плана Vercel.

export async function GET(req: Request): Promise<NextResponse> {
  // Fail-closed: без CRON_SECRET эндпоинт недоступен (прод/GitHub Actions шлют Bearer).
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const res = await detectNewEvents();
    return NextResponse.json({ ok: true, ...res, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/detect-events]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
