// Self-mirror ТОПОЛОГИИ бартеров и крафтов из tarkov.dev в нашу Supabase.
// Цены НЕ храним здесь — слоты это {itemId, count}; имя/иконка/цена подтянутся
// из `items` + `prices` при построении индикаторов.
//
// ИСТОЧНИК: JSON-плоскость (`json.tarkov.dev/{gameMode}/barters|crafts`, primary) с
// фолбэком на GraphQL — см. src/lib/tarkov-fallback.ts (повод: 2026-07-21 лёг только
// GraphQL). Имена торговцев/станций плоскость отдаёт плейсхолдерами → берём из
// tarkov-labels (TRADER_RU/STATION_RU), normalizedName из фида реальный.
// Трогает только syncEftBartersCrafts() — крон /api/cron/sync-prices и CLI
// `npm run db:sync-barters-crafts`. Импорты относительные (tsx-safe) кроме @/lib
// (tsx резолвит @/ через tsconfig paths).
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "./index";
import { barters, crafts, type TradeSlot } from "./schema";
import { eftGameId } from "./eft";
import { fetchMirrorRows, fetchTarkovJson } from "../lib/tarkov-fallback";
import { traderLabelMap, stationLabelMap } from "../lib/tarkov-labels";

// Порог защиты прюна: НЕ удаляем стейл-строки, если свежий набор из источника меньше этой
// доли уже лежащего в БД — страховка от частичного/обрезанного ответа (HTTP 200, но усечённый
// список). Легитимный вайп меняет id, но число бартеров/крафтов резко не режет.
const PRUNE_MIN_RATIO = 0.5;

/* ─────────────── строка БД (общая для обоих источников) ─────────────── */
interface BarterRow {
  id: string;
  gameId: string;
  traderName: string;
  traderNormalizedName: string | null;
  level: number | null;
  buyLimit: number | null;
  taskUnlockId: string | null;
  taskUnlockName: string | null;
  requiredItems: TradeSlot[];
  rewardItems: TradeSlot[];
}
interface CraftRow {
  id: string;
  gameId: string;
  stationName: string;
  stationNormalizedName: string | null;
  level: number | null;
  duration: number | null;
  requiredItems: TradeSlot[];
  rewardItems: TradeSlot[];
}

/* ─────────────── JSON-плоскость (primary) ─────────────── */
interface JsonSlot {
  item?: string; // id предмета (в GraphQL было item{id})
  count?: number;
}
interface JsonBarter {
  id: string;
  trader?: string; // id (имя резолвим через /traders + TRADER_RU)
  minTraderLevel?: number | null; // в GraphQL называлось level
  buyLimit?: number | null;
  taskUnlock?: string | null; // id квеста-анлока (имя даёт только GraphQL-фолбэк)
  requiredItems?: JsonSlot[];
  offeredItem?: JsonSlot | null; // в GraphQL было rewardItems[] — тут единичный
}
interface JsonCraft {
  id: string;
  station?: string; // id (имя резолвим через /hideout + STATION_RU)
  level?: number | null;
  duration?: number | null;
  requiredItems?: JsonSlot[];
  productItem?: JsonSlot | null; // в GraphQL было rewardItems[]
}

const toSlotsJson = (arr?: JsonSlot[]): TradeSlot[] =>
  (arr ?? [])
    .filter((s): s is JsonSlot & { item: string } => !!s.item)
    .map((s) => ({ itemId: s.item, count: s.count ?? 1 }));

async function bartersFromJson(gameId: string): Promise<BarterRow[]> {
  const [data, traders] = await Promise.all([
    fetchTarkovJson<Record<string, JsonBarter>>("regular/barters"),
    traderLabelMap(),
  ]);
  return Object.values(data)
    .filter((b) => b.id)
    .map((b) => {
      const t = b.trader ? traders.get(b.trader) : undefined;
      return {
        id: b.id,
        gameId,
        traderName: t?.name ?? b.trader ?? "-",
        traderNormalizedName: t?.normalizedName ?? b.trader ?? null,
        level: b.minTraderLevel ?? null,
        buyLimit: b.buyLimit ?? null,
        taskUnlockId: typeof b.taskUnlock === "string" ? b.taskUnlock : null,
        taskUnlockName: null,
        requiredItems: toSlotsJson(b.requiredItems),
        rewardItems: toSlotsJson(b.offeredItem ? [b.offeredItem] : []),
      };
    });
}

async function craftsFromJson(gameId: string): Promise<CraftRow[]> {
  const [data, stations] = await Promise.all([
    fetchTarkovJson<Record<string, JsonCraft>>("regular/crafts"),
    stationLabelMap(),
  ]);
  return Object.values(data)
    .filter((c) => c.id)
    .map((c) => {
      const s = c.station ? stations.get(c.station) : undefined;
      return {
        id: c.id,
        gameId,
        stationName: s?.name ?? c.station ?? "-",
        stationNormalizedName: s?.normalizedName ?? c.station ?? null,
        level: c.level ?? null,
        duration: c.duration ?? null,
        requiredItems: toSlotsJson(c.requiredItems),
        rewardItems: toSlotsJson(c.productItem ? [c.productItem] : []),
      };
    });
}

export interface SyncStaticResult {
  barters: number;
  crafts: number;
  bartersDeleted: number;
  craftsDeleted: number;
  bartersPruneSkipped: boolean;
  craftsPruneSkipped: boolean;
}

/** Тянет бартеры+крафты (JSON-primary → GraphQL-fallback) и bulk-upsert'ит в `barters`/`crafts`. */
export async function syncEftBartersCrafts(): Promise<SyncStaticResult> {
  const gameId = await eftGameId();

  const barterRows = await fetchMirrorRows<BarterRow>(() => bartersFromJson(gameId), "barters");
  const craftRows = await fetchMirrorRows<CraftRow>(() => craftsFromJson(gameId), "crafts");

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
          buyLimit: sql`excluded.buy_limit`,
          taskUnlockId: sql`excluded.task_unlock_id`,
          // taskUnlockName: JSON-плоскость имён не даёт → не затираем хорошее ru-имя пустым.
          taskUnlockName: sql`coalesce(excluded.task_unlock_name, ${barters.taskUnlockName})`,
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
  //   2) частичный/обрезанный ответ источника (HTTP 200, но, скажем, 12 из 778): прошёл бы
  //      both-empty-throw и `length > 0`, а delete снёс бы сотни ВАЛИДНЫХ строк. Гард:
  //      PRUNE_MIN_RATIO — если свежих сильно меньше, чем в БД, прюн пропускаем (данные целы).
  // Скоуп по gameId — мультиигровая БД. Счётчик удалённых — из command tag (res.count).
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
