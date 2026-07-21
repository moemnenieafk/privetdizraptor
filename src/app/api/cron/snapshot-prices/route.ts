// Суточный снимок цен барахолки в `price_history`.
// Читает из нашей `prices`, поэтому не зависит от доступности tarkov.dev —
// если их API лежит, снимок просто повторит последние известные значения.
// Идемпотентно: ключ (game, item, day), повторный прогон за те же сутки перезаписывает.
import { NextResponse } from "next/server";
import { snapshotPrices } from "@/db/price-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await snapshotPrices();
    return NextResponse.json({ ok: true, ...res, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/snapshot-prices]", e);
    const err = e as { message?: string; cause?: { message?: string; code?: string } };
    return NextResponse.json(
      {
        ok: false,
        error: err.message ?? String(e),
        dbError: err.cause?.message ?? null,
        dbCode: err.cause?.code ?? null,
      },
      { status: 500 },
    );
  }
}
