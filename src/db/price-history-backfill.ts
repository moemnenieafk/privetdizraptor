// Разовый бэкфил истории цен по наградам Рефа из tarkov.dev.
//
// Исключение из BACKEND AUTONOMY осознанное: это не рантайм, а ручной прогон через
// /api/cron/backfill-price-history. Своя история копится снимками и от источника не
// зависит; бэкфил лишь закрывает окно до того, как наберутся 30 суток.
//
// Строки помечаются source='tarkovdev'. Наши собственные снимки не перезаписываются:
// ON CONFLICT DO NOTHING — свои данные надёжнее чужих.
import { sql } from "drizzle-orm";
import { db } from "./index";
import { eftGameId } from "./eft";
import { getArenaOffers } from "./arena-offers";

const ENDPOINT = "https://api.tarkov.dev/graphql";

/** Предметов в одном GraphQL-запросе. Больше — рискуем положить чужой сервис. */
const BATCH_SIZE = 10;

/** Пауза между батчами, мс. */
const BATCH_DELAY_MS = 400;

export interface BackfillResult {
  items: number;
  days: number;
  inserted: number;
  skipped: number;
  window: { from: string; to: string } | null;
}

interface HistoricalPoint {
  price: number | null;
  timestamp: string | null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Сырые замеры с таймстампами сворачиваются в суточные значения по медиане. */
function toDailyMedians(points: HistoricalPoint[]): Map<string, number> {
  const buckets = new Map<string, number[]>();
  for (const p of points) {
    if (p.price === null || p.price <= 0 || !p.timestamp) continue;
    const ms = Number(p.timestamp);
    if (!Number.isFinite(ms)) continue;
    const day = new Date(ms).toISOString().slice(0, 10);
    const bucket = buckets.get(day);
    if (bucket) bucket.push(p.price);
    else buckets.set(day, [p.price]);
  }

  const daily = new Map<string, number>();
  for (const [day, values] of buckets) daily.set(day, Math.round(median(values)));
  return daily;
}

async function fetchBatch(ids: string[], days: number): Promise<Map<string, HistoricalPoint[]>> {
  const fields = ids
    .map((id, i) => `i${i}: item(id: "${id}") { id historicalPrices(days: ${days}) { price timestamp } }`)
    .join("\n");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: `{ ${fields} }` }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`tarkov.dev responded ${response.status}`);

  const payload = (await response.json()) as {
    data?: Record<string, { id: string; historicalPrices?: HistoricalPoint[] } | null>;
    errors?: { message?: string }[];
  };
  if (payload.errors?.length) throw new Error(payload.errors[0]?.message ?? "graphql error");

  const result = new Map<string, HistoricalPoint[]>();
  for (const entry of Object.values(payload.data ?? {})) {
    if (entry?.id) result.set(entry.id, entry.historicalPrices ?? []);
  }
  return result;
}

/** Тянет историю по наградам арена-предложений Рефа и доливает недостающие сутки. */
export async function backfillPriceHistory(days: number): Promise<BackfillResult> {
  const gameId = await eftGameId();
  const { offers } = await getArenaOffers("acquire", "spot");
  const ids = [...new Set(offers.map((o) => o.rewardId))];

  if (ids.length === 0) return { items: 0, days: 0, inserted: 0, skipped: 0, window: null };

  const rows: { id: string; day: string; price: number }[] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const fetched = await fetchBatch(batch, days);
    for (const [id, points] of fetched) {
      for (const [day, price] of toDailyMedians(points)) rows.push({ id, day, price });
    }
    if (i + BATCH_SIZE < ids.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  if (rows.length === 0) return { items: ids.length, days: 0, inserted: 0, skipped: 0, window: null };

  const values = sql.join(
    rows.map((r) => sql`(${gameId}::uuid, ${r.id}, ${r.day}::date, ${r.price}::int, 'tarkovdev')`),
    sql`, `,
  );

  // DO NOTHING: свой снимок за эти сутки, если он уже есть, надёжнее чужой истории.
  const inserted = await db.execute<{ count: number }>(sql`
    with upserted as (
      insert into price_history (game_id, in_game_id, day, avg_price, source)
      values ${values}
      on conflict (game_id, in_game_id, day) do nothing
      returning 1
    )
    select count(*)::int as count from upserted
  `);

  const insertedCount = [...inserted][0]?.count ?? 0;
  const allDays = [...new Set(rows.map((r) => r.day))].sort();

  return {
    items: ids.length,
    days: allDays.length,
    inserted: insertedCount,
    skipped: rows.length - insertedCount,
    window: { from: allDays[0], to: allDays[allDays.length - 1] },
  };
}
