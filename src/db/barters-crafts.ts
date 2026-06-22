// Self-mirror ТОПОЛОГИИ бартеров и крафтов из tarkov.dev в нашу Supabase.
// Цены НЕ храним здесь — слоты это {itemId, count}; имя/иконка/цена подтянутся
// из `items` + `prices` при построении индикаторов (Часть 2, миграция категорий).
//
// Источник трогает только syncEftBartersCrafts() — крон /api/cron/sync-prices
// и CLI `npm run db:sync-barters-crafts`. Импорты относительные (tsx-safe).
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "./index";
import { barters, crafts, type TradeSlot } from "./schema";
import { eftGameId } from "./eft";

const ENDPOINT = "https://api.tarkov.dev/graphql";

// Порог защиты прюна: НЕ удаляем стейл-строки, если свежий набор из источника меньше этой
// доли уже лежащего в БД — страховка от частичного/обрезанного ответа tarkov.dev (HTTP 200,
// но усечённый список). Легитимный вайп меняет id, но число бартеров/крафтов резко не режет.
const PRUNE_MIN_RATIO = 0.5;

/* ───────────────── сырой ответ API (без any) ───────────────── */
interface RawSlot {
  count?: number;
  item?: { id?: string } | null;
}
interface RawBarter {
  id: string;
  trader?: { name?: string; normalizedName?: string };
  level?: number;
  taskUnlock?: { id?: string; name?: string } | null;
  requiredItems?: RawSlot[];
  rewardItems?: RawSlot[];
}
interface RawCraft {
  id: string;
  station?: { name?: string; normalizedName?: string };
  level?: number;
  duration?: number;
  requiredItems?: RawSlot[];
  rewardItems?: RawSlot[];
}
interface RawResponse {
  data?: { barters?: RawBarter[]; crafts?: RawCraft[] };
  errors?: unknown;
}

const QUERY = `
  query {
    barters(lang: ru) {
      id
      trader { name normalizedName }
      level
      taskUnlock { id name }
      requiredItems { count item { id } }
      rewardItems  { count item { id } }
    }
    crafts(lang: ru) {
      id
      station { name normalizedName }
      level
      duration
      requiredItems { count item { id } }
      rewardItems  { count item { id } }
    }
  }
`;

const toSlots = (arr?: RawSlot[]): TradeSlot[] =>
  (arr ?? [])
    .filter((s): s is RawSlot & { item: { id: string } } => !!s.item?.id)
    .map((s) => ({ itemId: s.item.id, count: s.count ?? 1 }));

export interface SyncStaticResult {
  barters: number;
  crafts: number;
  bartersDeleted: number;
  craftsDeleted: number;
  bartersPruneSkipped: boolean;
  craftsPruneSkipped: boolean;
}

/** Тянет бартеры+крафты из tarkov.dev и bulk-upsert'ит в таблицы `barters`/`crafts`. */
export async function syncEftBartersCrafts(): Promise<SyncStaticResult> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tarkov.dev barters/crafts → HTTP ${res.status}`);
  const json = (await res.json()) as RawResponse;
  if (json.errors || !json.data) throw new Error("tarkov.dev barters/crafts: ошибочный/пустой ответ");

  const gameId = await eftGameId();

  const barterRows = (json.data.barters ?? [])
    .filter((b) => b.id)
    .map((b) => ({
      id: b.id,
      gameId,
      traderName: b.trader?.name ?? "-",
      traderNormalizedName: b.trader?.normalizedName ?? null,
      level: b.level ?? null,
      taskUnlockId: b.taskUnlock?.id ?? null,
      taskUnlockName: b.taskUnlock?.name ?? null,
      requiredItems: toSlots(b.requiredItems),
      rewardItems: toSlots(b.rewardItems),
    }));

  const craftRows = (json.data.crafts ?? [])
    .filter((c) => c.id)
    .map((c) => ({
      id: c.id,
      gameId,
      stationName: c.station?.name ?? "-",
      stationNormalizedName: c.station?.normalizedName ?? null,
      level: c.level ?? null,
      duration: c.duration ?? null,
      requiredItems: toSlots(c.requiredItems),
      rewardItems: toSlots(c.rewardItems),
    }));

  if (barterRows.length === 0 && craftRows.length === 0) {
    throw new Error("barters/crafts пусто — синк отменён (старые данные сохранены)");
  }

  const CHUNK = 500;
  for (let i = 0; i < barterRows.length; i += CHUNK) {
    await db
      .insert(barters)
      .values(barterRows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: barters.id,
        set: {
          traderName: sql`excluded.trader_name`,
          traderNormalizedName: sql`excluded.trader_normalized_name`,
          level: sql`excluded.level`,
          taskUnlockId: sql`excluded.task_unlock_id`,
          taskUnlockName: sql`excluded.task_unlock_name`,
          requiredItems: sql`excluded.required_items`,
          rewardItems: sql`excluded.reward_items`,
          syncedAt: sql`now()`,
        },
      });
  }
  for (let i = 0; i < craftRows.length; i += CHUNK) {
    await db
      .insert(crafts)
      .values(craftRows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: crafts.id,
        set: {
          stationName: sql`excluded.station_name`,
          stationNormalizedName: sql`excluded.station_normalized_name`,
          level: sql`excluded.level`,
          duration: sql`excluded.duration`,
          requiredItems: sql`excluded.required_items`,
          rewardItems: sql`excluded.reward_items`,
          syncedAt: sql`now()`,
        },
      });
  }

  // Чистим стейл-строки — бартеры/крафты, исчезнувшие из источника (типично при вайпе).
  // ⚠️ Два разрушительных края, оба отсекаем ПЕРЕД delete:
  //   1) пустой свежий набор — notInArray(col, []) компилируется в SQL `true` → снесло бы
  //      ВСЮ таблицу. Гард: `rows.length > 0`.
  //   2) частичный/обрезанный ответ источника (HTTP 200, но, скажем, 12 из 778 — обрезка
  //      CDN/edge или полу-сломанный резолвер без top-level `errors`): прошёл бы res.ok,
  //      json.errors, both-empty-throw и `length > 0`, а delete снёс бы сотни ВАЛИДНЫХ
  //      строк. Гард: PRUNE_MIN_RATIO — если свежих сильно меньше, чем уже в БД, прюн
  //      пропускаем (данные целы) и пишем варн.
  // Скоуп по gameId — мультиигровая БД, чужие игры не задеваем. Счётчик удалённых — из
  // command tag (res.count), без .returning(): не тащим тело удалённых строк по пулеру.
  let bartersDeleted = 0;
  let craftsDeleted = 0;
  let bartersPruneSkipped = false;
  let craftsPruneSkipped = false;

  if (barterRows.length > 0) {
    const had = await db.$count(barters, eq(barters.gameId, gameId));
    if (barterRows.length < had * PRUNE_MIN_RATIO) {
      bartersPruneSkipped = true;
      console.warn(
        `[barters-crafts] прюн бартеров пропущен: свежих ${barterRows.length} << в БД ${had} (похоже на частичный ответ источника)`,
      );
    } else {
      const keep = barterRows.map((r) => r.id);
      const res = await db
        .delete(barters)
        .where(and(eq(barters.gameId, gameId), notInArray(barters.id, keep)));
      bartersDeleted = res.count;
    }
  }

  if (craftRows.length > 0) {
    const had = await db.$count(crafts, eq(crafts.gameId, gameId));
    if (craftRows.length < had * PRUNE_MIN_RATIO) {
      craftsPruneSkipped = true;
      console.warn(
        `[barters-crafts] прюн крафтов пропущен: свежих ${craftRows.length} << в БД ${had} (похоже на частичный ответ источника)`,
      );
    } else {
      const keep = craftRows.map((r) => r.id);
      const res = await db
        .delete(crafts)
        .where(and(eq(crafts.gameId, gameId), notInArray(crafts.id, keep)));
      craftsDeleted = res.count;
    }
  }

  return {
    barters: barterRows.length,
    crafts: craftRows.length,
    bartersDeleted,
    craftsDeleted,
    bartersPruneSkipped,
    craftsPruneSkipped,
  };
}
