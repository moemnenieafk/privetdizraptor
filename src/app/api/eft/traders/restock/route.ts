// GET /api/eft/traders/restock?mode=PVP — ресток торговцев поверх НАШЕГО зеркала.
// Данные: getEftTraders() (таблица traders, синк tarkov.dev кроном) + статика TRADERS
// (портрет/валюта/RU-имя). Рантайм без внешних API (BACKEND AUTONOMY §4.11).
// Ростер = торговцы с непустым resetTime → Скупщик/Смотритель/БТР отсеиваются данными.
// Клиент сам тикает и экстраполирует (src/lib/eft-restock.ts) — сервер отдаёт якорь.
import { NextResponse } from "next/server";
import { getEftTraders } from "@/db/landing";
import { getTrader } from "@/data/traders";
import { DEFAULT_RESTOCK_INTERVAL_SEC, RESTOCK_TRADER_SLUGS, type RestockPayload, type RestockTrader } from "@/lib/eft-restock";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  if (!(await rateLimit(`eft-restock:ip:${clientIp(req)}`, 120, 300))) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const mode = (new URL(req.url).searchParams.get("mode") ?? "PVP").toUpperCase();

  const allow = new Set<string>(RESTOCK_TRADER_SLUGS);
  const rows = await getEftTraders();
  const traders: RestockTrader[] = rows
    .filter((r) => !!r.resetTime && allow.has(r.normalizedName)) // каноничный ростер рестока
    .map((r) => {
      const meta = getTrader(r.normalizedName);
      return {
        slug: r.normalizedName,
        nameRu: meta?.nameRu ?? r.name,
        nameEn: meta?.nameEn ?? r.name,
        image: meta?.image ?? "",
        currency: meta?.currency ?? "₽",
        resetTime: r.resetTime,
        // приоритет: калибровка из БД (Фаза 2) → статик-оверрайд → бутстрап-дефолт
        intervalSec: r.restockIntervalSec ?? meta?.restockIntervalSec ?? DEFAULT_RESTOCK_INTERVAL_SEC,
      };
    })
    // ближайший ресток — первым (клиент всё равно пересортирует по живому now)
    .sort((a, b) => new Date(a.resetTime!).getTime() - new Date(b.resetTime!).getTime());

  const payload: RestockPayload = { gameMode: mode, updated: Date.now(), traders };
  return NextResponse.json(payload);
}
