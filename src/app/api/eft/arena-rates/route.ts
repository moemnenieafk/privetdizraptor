// GET /api/eft/arena-rates?basis=acquire|liquidate&level=1..4
// Курс GP-монеты и Лега-медали в рублях, выведенный из ассортимента Рефа.
// Read-only поверх НАШЕГО зеркала (barters + prices + items) — рантайм без внешних
// API (BACKEND AUTONOMY). Формулы и ограничения: docs/EFT_CURRENCY_MODEL.md
import { NextResponse } from "next/server";
import { getArenaOffers } from "@/db/arena-offers";
import { calcGpCurve, calcLegaValue } from "@/lib/arena-currency";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { memoTTL } from "@/lib/server-cache";
import type { ArenaHealth, ArenaRates, ArenaValuationBasis } from "@/types/arena-currency";

export const runtime = "nodejs";
// Хендлер читает query и IP → он динамический по определению. `export const revalidate`
// здесь недопустим: билд попытается отрендерить роут статически и упадёт. Кэш держим
// на memoTTL (процесс) + Cache-Control (CDN) — как в остальных публичных ручках.
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 60 * 1000;

/** Ниже этой ёмкости кривая перестаёт быть репрезентативной. */
const MIN_CAPACITY = 50;

function parseBasis(value: string | null): ArenaValuationBasis {
  return value === "liquidate" ? "liquidate" : "acquire";
}

function parseLevel(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 4;
}

/**
 * Самодиагностика. Синк бартеров в /api/cron/sync-prices — best-effort: его падение
 * не роняет прайс-синк и потому НЕ ВИДНО снаружи. Без этого блока курс мог бы месяцами
 * считаться по пустым лимитам, и заметили бы только глазами на карточке.
 */
function buildHealth(offersTotal: number, limitsKnown: number, capacity: number, sampleSize: number): ArenaHealth {
  const reasons: string[] = [];
  if (sampleSize === 0) reasons.push("в кривую не попало ни одного предложения: нет цен на награды");
  if (offersTotal > 0 && limitsKnown === 0) reasons.push("buy_limit пуст — прогони sync-prices");
  if (sampleSize > 0 && capacity < MIN_CAPACITY) reasons.push(`ёмкость кривой ${capacity} GP — подозрительно мало`);

  const status: ArenaHealth["status"] = sampleSize === 0 ? "empty" : reasons.length > 0 ? "degraded" : "ok";
  return { status, reasons, offersTotal, limitsKnown };
}

async function computeRates(basis: ArenaValuationBasis, maxLevel: number): Promise<ArenaRates> {
  const offers = await getArenaOffers(basis);
  const gp = calcGpCurve(offers, { basis, maxLevel });
  const lega = calcLegaValue(offers, gp);
  const limitsKnown = offers.filter((o) => o.buyLimit !== null).length;
  const health = buildHealth(offers.length, limitsKnown, gp.capacity, gp.sampleSize);
  return { gp, lega, health, computedAt: new Date().toISOString() };
}

export async function GET(req: Request): Promise<NextResponse> {
  // Публичная ручка без сессии → лимит по IP, как на /api/eft/prices.
  if (!(await rateLimit(`eft-arena-rates:ip:${clientIp(req)}`, 60, 300))) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const url = new URL(req.url);
  const basis = parseBasis(url.searchParams.get("basis"));
  const maxLevel = parseLevel(url.searchParams.get("level"));

  try {
    const rates = await memoTTL(`arena-rates:${basis}:${maxLevel}`, CACHE_TTL_MS, () =>
      computeRates(basis, maxLevel),
    );
    return NextResponse.json(rates, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    console.error("[api/eft/arena-rates]", e);
    return NextResponse.json({ error: "rates unavailable" }, { status: 503 });
  }
}
