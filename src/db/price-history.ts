// Суточные снимки цен и агрегаты по ним.
// Спотовая цена (`lastLowPrice`) — самое дешёвое живое предложение в моменте; она
// скачет в разы за сутки, и любой расчёт поверх неё шумит на десятки процентов.
// Здесь копится история, из которой берётся устойчивая оценка за месяц.
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { priceHistory } from "./schema";
import { eftGameId } from "./eft";

/** Глубина хранения снимков. Больше месяца нужно, чтобы окно всегда было полным. */
const RETENTION_DAYS = 60;

/** Окно, по которому считается месячная оценка. */
export const MONTH_WINDOW_DAYS = 30;

/** Меньше этого числа точек — истории недостаточно, откатываемся на спот. */
export const MIN_HISTORY_POINTS = 3;

export interface SnapshotResult {
  written: number;
  pruned: number;
  day: string;
}

/**
 * Пишет снимок за текущие сутки по всем предметам с ценой и подчищает старьё.
 * Идемпотентно: ключ (game, item, day), повторный прогон перезаписывает строку.
 * Читает из нашей `prices`, поэтому не зависит от доступности внешнего API.
 */
export async function snapshotPrices(): Promise<SnapshotResult> {
  const gameId = await eftGameId();

  const inserted = await db.execute<{ count: number }>(sql`
    with upserted as (
      insert into price_history (game_id, in_game_id, day, avg_price, low_price)
      select game_id, in_game_id, current_date, avg24h_price, last_low_price
        from prices
       where game_id = ${gameId}
         and (avg24h_price is not null or last_low_price is not null)
      on conflict (game_id, in_game_id, day) do update
         set avg_price = excluded.avg_price,
             low_price = excluded.low_price,
             synced_at = now()
      returning 1
    )
    select count(*)::int as count from upserted
  `);

  const pruned = await db.execute<{ count: number }>(sql`
    with removed as (
      delete from price_history
       where day < current_date - ${RETENTION_DAYS}::int
      returning 1
    )
    select count(*)::int as count from removed
  `);

  const today = await db.execute<{ day: string }>(sql`select current_date::text as day`);

  return {
    written: [...inserted][0]?.count ?? 0,
    pruned: [...pruned][0]?.count ?? 0,
    day: [...today][0]?.day ?? new Date().toISOString().slice(0, 10),
  };
}

export interface MonthlyPrice {
  /** Медиана суточных значений — устойчива к выбросам вроде разового выкупа. */
  median: number;
  /** Среднее — для сравнения с медианой, в расчёт по умолчанию не идёт. */
  mean: number;
  /** Сколько суток попало в окно. */
  points: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Месячная оценка по списку предметов. Берётся `avg_price` (суточное сглаживание
 * источника), при его отсутствии — `low_price`. Предметы без достаточной истории
 * в результат не попадают: вызывающая сторона откатывается на спот.
 */
export async function getMonthlyPrices(
  inGameIds: string[],
  windowDays: number = MONTH_WINDOW_DAYS,
): Promise<Map<string, MonthlyPrice>> {
  const result = new Map<string, MonthlyPrice>();
  if (inGameIds.length === 0) return result;

  const gameId = await eftGameId();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const rows = await db
    .select({
      inGameId: priceHistory.inGameId,
      avgPrice: priceHistory.avgPrice,
      lowPrice: priceHistory.lowPrice,
    })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.gameId, gameId),
        gte(priceHistory.day, since),
        inArray(priceHistory.inGameId, inGameIds),
      ),
    );

  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    const value = row.avgPrice ?? row.lowPrice;
    if (value === null || value <= 0) continue;
    const bucket = buckets.get(row.inGameId);
    if (bucket) bucket.push(value);
    else buckets.set(row.inGameId, [value]);
  }

  for (const [id, values] of buckets) {
    if (values.length < MIN_HISTORY_POINTS) continue;
    const sum = values.reduce((a, b) => a + b, 0);
    result.set(id, { median: median(values), mean: sum / values.length, points: values.length });
  }

  return result;
}
