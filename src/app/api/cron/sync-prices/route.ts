// Cron: зеркалит цены EFT из tarkov.dev в нашу таблицу `prices`.
// Вызывается Vercel Cron по расписанию из vercel.json. Защита — CRON_SECRET
// (Vercel шлёт `Authorization: Bearer ${CRON_SECRET}`, если переменная задана).
// Это ЕДИНСТВЕННОЕ место, где наш бэкенд ходит в api.tarkov.dev.
import { NextResponse } from "next/server";
import { syncEftPrices } from "@/db/prices";
import { syncEftBartersCrafts } from "@/db/barters-crafts";
import { syncEftLandingData } from "@/db/landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // макс. для Hobby-плана Vercel (120 невалидно → сброс в 10с)

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Цены — критичны (частый синк). Бартеры/крафты — best-effort: их сбой не должен
    // ронять прайс-синк (они меняются раз в вайп, не ежечасно).
    const priceRes = await syncEftPrices();
    let staticRes = { barters: 0, crafts: 0 };
    try {
      staticRes = await syncEftBartersCrafts();
    } catch (e) {
      console.error("[cron/sync-prices] barters/crafts:", e);
    }
    let landingRes = { achievements: 0, maps: 0, traders: 0 };
    try {
      landingRes = await syncEftLandingData();
    } catch (e) {
      console.error("[cron/sync-prices] landing:", e);
    }
    return NextResponse.json({ ok: true, ...priceRes, ...staticRes, ...landingRes, at: new Date().toISOString() });
  } catch (e) {
    // Эндпоинт за CRON_SECRET (только админ/крон) — отдаём реальный текст ошибки
    // вызывающему, чтобы было видно причину в логах GitHub Actions / Vercel.
    console.error("[cron/sync-prices]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
