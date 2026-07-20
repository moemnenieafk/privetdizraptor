// GET /api/eft/arena-rates?basis=acquire|liquidate&level=1..4
// Курс GP-монеты и Лега-медали в рублях, выведенный из ассортимента Рефа.
// Read-only поверх НАШЕГО зеркала (barters + prices + items) — рантайм без внешних
// API (BACKEND AUTONOMY). Формулы и ограничения: docs/EFT_CURRENCY_MODEL.md
import { NextResponse } from "next/server";
import { getArenaOffers } from "@/db/arena-offers";
import { calcGpCurve, calcLegaValue } from "@/lib/arena-currency";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { memoTTL } from "@/lib/server-cache";
import type { ArenaRates, ArenaValuationBasis } from "@/types/arena-currency";

export const runtime = "nodejs";
export const revalidate = 3600;

const CACHE_TTL_MS = 60 * 60 * 1000;

function parseBasis(value: string | null): ArenaValuationBasis {
  return value === "liquidate" ? "liquidate" : "acquire";
}

function parseLevel(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 4;
}

async function computeRates(basis: ArenaValuationBasis, maxLevel: number): Promise<ArenaRates> {
  const offers = await getArenaOffers(basis);
  const gp = calcGpCurve(offers, { basis, maxLevel });
  const lega = calcLegaValue(offers, gp);
  return { gp, lega, computedAt: new Date().toISOString() };
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
