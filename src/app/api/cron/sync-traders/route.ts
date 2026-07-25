// Cron (Фаза 3): частый ЛЁГКИЙ синк торговцев EFT из tarkov.dev → таблица `traders`.
// Держит reset_time свежим для виджета «Завоз» и ускоряет Фаза-2 калибровку интервала.
// Отдельно от sync-prices (тот тяжёлый, раз в час) — этот дешёвый, можно чаще.
// Дёргается GitHub Actions (.github/workflows/sync-traders.yml). Защита — CRON_SECRET.
// Единственный контакт наружу — здесь, как и у остальных кронов (BACKEND AUTONOMY).
import { NextResponse } from "next/server";
import { syncEftTraders } from "@/db/landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await syncEftTraders();
    return NextResponse.json({ ok: true, ...res, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/sync-traders]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
