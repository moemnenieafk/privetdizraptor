// Агрегатор краудсорс-цен компаньона: сырьё `companion_flea_offers` → «живая» цена.
// Фаза 0 ([[eft-live-price-companion]]): ТОЛЬКО захват + агрегат. Перезапись боевой
// цены в `prices` — Фаза 2 (после quality-гейтов). Здесь ничего не мутируем в prices.
import { sql } from "drizzle-orm";
import { db } from "./index";
import { companionFleaOffers } from "./schema";

export type CompanionGameMode = "regular" | "pve";

// ── Конфиг доверия (тюнится тут; дефолты — из решения V4DYA 2026-07-23) ──────────
export const TRUST = {
  /** Мин. число НЕЗАВИСИМЫХ авторов сабмита на предмет, чтобы цена считалась «живой». */
  MIN_SUBMITTERS: 3,
  /** Окно свежести: офферы старше — не участвуют в агрегате. */
  WINDOW_MIN: 30,
  /** Санити-границы цены за штуку (₽) — грубый отсев мусора OCR на приёме. */
  PRICE_MIN: 1,
  PRICE_MAX: 1_000_000_000,
  /** Максимум офферов в одном сабмите (анти-флуд на приёме). */
  MAX_OFFERS_PER_REQUEST: 500,
} as const;

export interface CompanionPrice {
  price: number; // медиана по окну (робастна к выбросам OCR)
  offers: number; // сколько офферов легло в расчёт
  submitters: number; // сколько независимых авторов (порог доверия)
  freshestAt: Date; // самый свежий оффер в окне
}

export interface CompanionOfferInput {
  inGameId: string;
  price: number;
}

/**
 * Агрегат по окну: median цены на предмет там, где ≥ MIN_SUBMITTERS независимых авторов.
 * Считаем в SQL (percentile_cont) — по всем предметам разом, без вытаскивания сырья в JS.
 * Возвращает Map<inGameId, CompanionPrice>. Пусто (cold-start) — норм, не бросаем.
 */
export async function getCompanionPriceMap(
  gameId: string,
  gameMode: CompanionGameMode = "regular",
): Promise<Map<string, CompanionPrice>> {
  try {
    const rows = (await db.execute(sql`
      select
        in_game_id                                            as "inGameId",
        percentile_cont(0.5) within group (order by price)::int as "price",
        count(*)::int                                         as "offers",
        count(distinct submitted_by)::int                    as "submitters",
        max(submitted_at)                                    as "freshestAt"
      from public.companion_flea_offers
      where game_id = ${gameId}
        and game_mode = ${gameMode}
        and submitted_at >= now() - make_interval(mins => ${TRUST.WINDOW_MIN}::int)
      group by in_game_id
      having count(distinct submitted_by) >= ${TRUST.MIN_SUBMITTERS}
    `)) as unknown as Array<{
      inGameId: string;
      price: number;
      offers: number;
      submitters: number;
      freshestAt: string | Date;
    }>;

    const map = new Map<string, CompanionPrice>();
    for (const r of rows) {
      map.set(r.inGameId, {
        price: r.price,
        offers: r.offers,
        submitters: r.submitters,
        freshestAt: new Date(r.freshestAt),
      });
    }
    return map;
  } catch (e) {
    console.error("[getCompanionPriceMap]", e);
    return new Map();
  }
}

/**
 * Вставка сырых офферов от одного автора. Валидация границ — на вызывающей стороне
 * (route); здесь финальная страховка + bulk insert. Возвращает число принятых строк.
 */
export async function insertCompanionOffers(
  gameId: string,
  gameMode: CompanionGameMode,
  submittedBy: string,
  offers: CompanionOfferInput[],
): Promise<number> {
  const rows = offers
    .filter(
      (o) =>
        /^[0-9a-f]{24}$/i.test(o.inGameId) &&
        Number.isInteger(o.price) &&
        o.price >= TRUST.PRICE_MIN &&
        o.price <= TRUST.PRICE_MAX,
    )
    .map((o) => ({ gameId, inGameId: o.inGameId, gameMode, price: o.price, submittedBy }));

  if (rows.length === 0) return 0;
  await db.insert(companionFleaOffers).values(rows);
  return rows.length;
}
