// Cron: зеркалит цены EFT из tarkov.dev в нашу таблицу `prices`.
// Вызывается Vercel Cron по расписанию из vercel.json. Защита — CRON_SECRET
// (Vercel шлёт `Authorization: Bearer ${CRON_SECRET}`, если переменная задана).
// Это ЕДИНСТВЕННОЕ место, где наш бэкенд ходит в api.tarkov.dev.
import { NextResponse } from "next/server";
import { syncEftPrices } from "@/db/prices";
import { syncEftBartersCrafts } from "@/db/barters-crafts";
import { syncEftLandingData } from "@/db/landing";
import { syncEftMapsGeometry } from "@/db/maps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // макс. для Hobby-плана Vercel (120 невалидно → сброс в 10с)

export async function GET(req: Request): Promise<NextResponse> {
  // Fail-closed: без заданного CRON_SECRET эндпоинт НЕДОСТУПЕН (раньше при пустом
  // секрете запись в БД мог триггерить кто угодно). Прод/GitHub Actions шлют Bearer.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Цены — критичны (частый синк). Бартеры/крафты — best-effort: их сбой не должен
    // ронять прайс-синк (они меняются раз в вайп, не ежечасно).
    const priceRes = await syncEftPrices();
    let staticRes = {
      barters: 0,
      crafts: 0,
      bartersDeleted: 0,
      craftsDeleted: 0,
      bartersPruneSkipped: false,
      craftsPruneSkipped: false,
    };
    try {
      staticRes = await syncEftBartersCrafts();
    } catch (e) {
      console.error("[cron/sync-prices] barters/crafts:", e);
    }
    let landingRes = {
      achievements: 0,
      maps: 0,
      traders: 0,
      achievementsDeleted: 0,
      mapsDeleted: 0,
      tradersDeleted: 0,
      achievementsPruneSkipped: false,
      mapsPruneSkipped: false,
      tradersPruneSkipped: false,
    };
    try {
      landingRes = await syncEftLandingData();
    } catch (e) {
      console.error("[cron/sync-prices] landing:", e);
    }
    // Геометрия карт (Phase 4) — best-effort: меняется раз в вайп, не должна ронять прайс-синк.
    let mapsRes = {
      maps: 0,
      assets: 0,
      markers: 0,
      markersDeleted: 0,
      assetsDeleted: 0,
      markersPruneSkipped: 0,
      assetsPruneSkipped: false,
    };
    try {
      mapsRes = await syncEftMapsGeometry();
    } catch (e) {
      console.error("[cron/sync-prices] maps-geometry:", e);
    }
    return NextResponse.json({
      ok: true,
      ...priceRes,
      ...staticRes,
      ...landingRes,
      mapsGeometry: mapsRes,
      at: new Date().toISOString(),
    });
  } catch (e) {
    // Эндпоинт за CRON_SECRET (только админ/крон) — отдаём реальный текст ошибки
    // вызывающему, чтобы было видно причину в логах GitHub Actions / Vercel.
    console.error("[cron/sync-prices]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
