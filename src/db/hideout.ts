// Self-mirror требований апгрейдов убежища из tarkov.dev в нашу Supabase.
// Цены/имена НЕ храним — itemRequirements это {itemId, count}; подтянутся из
// `items` + `prices` при чтении («Нужные предметы», гейты craft-profit).
//
// Источник трогает только syncEftHideout() — CLI `npm run db:sync-hideout`.
// Ключи (станция+уровень) стабильны между вайпами → чистый upsert без прюна.
// Импорты относительные (tsx-safe).
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  hideoutUpgrades,
  items,
  type HideoutItemReq,
  type HideoutModuleReq,
  type HideoutTraderReq,
  type HideoutSkillReq,
} from "./schema";
import { eftGameId } from "./eft";

const ENDPOINT = "https://api.tarkov.dev/graphql";

/* ───────────────── сырой ответ API (без any) ───────────────── */
interface RawItemReq {
  count?: number;
  item?: { id?: string } | null;
}
interface RawStationReq {
  level?: number;
  station?: { normalizedName?: string } | null;
}
interface RawTraderReq {
  level?: number;
  trader?: { normalizedName?: string } | null;
}
interface RawSkillReq {
  name?: string;
  level?: number;
}
interface RawLevel {
  level?: number;
  constructionTime?: number;
  itemRequirements?: RawItemReq[];
  stationLevelRequirements?: RawStationReq[];
  traderRequirements?: RawTraderReq[];
  skillRequirements?: RawSkillReq[];
}
interface RawStation {
  name?: string;
  normalizedName?: string;
  levels?: RawLevel[];
}
interface RawResponse {
  data?: { hideoutStations?: RawStation[] };
  errors?: unknown;
}

const QUERY = `
  query {
    hideoutStations(lang: ru) {
      name
      normalizedName
      levels {
        level
        constructionTime
        itemRequirements { count item { id } }
        stationLevelRequirements { level station { normalizedName } }
        traderRequirements { level trader { normalizedName } }
        skillRequirements { name level }
      }
    }
  }
`;

const toItems = (arr?: RawItemReq[]): HideoutItemReq[] =>
  (arr ?? [])
    .filter((s): s is RawItemReq & { item: { id: string } } => !!s.item?.id)
    .map((s) => ({ itemId: s.item.id, count: s.count ?? 1 }));

const toStations = (arr?: RawStationReq[]): HideoutModuleReq[] =>
  (arr ?? [])
    .filter((s): s is RawStationReq & { station: { normalizedName: string } } => !!s.station?.normalizedName)
    .map((s) => ({ station: s.station.normalizedName, level: s.level ?? 1 }));

const toTraders = (arr?: RawTraderReq[]): HideoutTraderReq[] =>
  (arr ?? [])
    .filter((s): s is RawTraderReq & { trader: { normalizedName: string } } => !!s.trader?.normalizedName)
    .map((s) => ({ trader: s.trader.normalizedName, level: s.level ?? 1 }));

const toSkills = (arr?: RawSkillReq[]): HideoutSkillReq[] =>
  (arr ?? [])
    .filter((s): s is RawSkillReq & { name: string } => !!s.name)
    .map((s) => ({ skill: s.name, level: s.level ?? 1 }));

export interface SyncHideoutResult {
  stations: number;
  upgrades: number;
}

/** Тянет апгрейды убежища из tarkov.dev и bulk-upsert'ит в `hideout_upgrades`. */
export async function syncEftHideout(): Promise<SyncHideoutResult> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tarkov.dev hideout → HTTP ${res.status}`);
  const json = (await res.json()) as RawResponse;
  if (json.errors || !json.data) throw new Error("tarkov.dev hideout: ошибочный/пустой ответ");

  const gameId = await eftGameId();
  const stations = json.data.hideoutStations ?? [];

  const rows = stations.flatMap((st) =>
    (st.levels ?? [])
      .filter((lv) => lv.level != null)
      .map((lv) => ({
        gameId,
        stationNormalizedName: st.normalizedName ?? "-",
        stationName: st.name ?? "-",
        level: lv.level as number,
        constructionTime: lv.constructionTime ?? null,
        itemRequirements: toItems(lv.itemRequirements),
        stationRequirements: toStations(lv.stationLevelRequirements),
        traderRequirements: toTraders(lv.traderRequirements),
        skillRequirements: toSkills(lv.skillRequirements),
      })),
  );

  if (rows.length === 0) {
    throw new Error("hideout пусто — синк отменён (старые данные сохранены)");
  }

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(hideoutUpgrades)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [hideoutUpgrades.gameId, hideoutUpgrades.stationNormalizedName, hideoutUpgrades.level],
        set: {
          stationName: sql`excluded.station_name`,
          constructionTime: sql`excluded.construction_time`,
          itemRequirements: sql`excluded.item_requirements`,
          stationRequirements: sql`excluded.station_requirements`,
          traderRequirements: sql`excluded.trader_requirements`,
          skillRequirements: sql`excluded.skill_requirements`,
          syncedAt: sql`now()`,
        },
      });
  }

  return { stations: stations.length, upgrades: rows.length };
}

/* ───────────────── чтение для UI: агрегатор «нужно для убежища» ───────────────── */

// Валюты — не «собираемые» предметы, в шопинг-лист не включаем (₽/€/$).
const CURRENCY_IDS = new Set([
  "5449016a4bdc2d6f028b456f", // ₽ Roubles
  "569668774bdc2da2298b4568", // € Euros
  "5696686a4bdc2da3298b456a", // $ Dollars
]);

export interface HideoutNeedSource {
  station: string;
  stationName: string;
  level: number;
  count: number;
}
export interface HideoutNeed {
  itemId: string;
  itemName: string;
  itemShort: string;
  total: number;
  sources: HideoutNeedSource[];
}

/**
 * Агрегатор предметов, нужных на полную застройку убежища (по всем апгрейдам).
 * Группировка по предмету; источники = станция+уровень+кол-во. Имена — из `items`,
 * иконка добавляется на уровне страницы (itemIconUrl). Валюта исключена. RSC-only.
 */
export async function getHideoutNeeds(): Promise<HideoutNeed[]> {
  const gameId = await eftGameId();
  const rows = await db
    .select()
    .from(hideoutUpgrades)
    .where(eq(hideoutUpgrades.gameId, gameId));

  const map = new Map<string, HideoutNeed>();
  for (const r of rows) {
    for (const req of r.itemRequirements) {
      if (CURRENCY_IDS.has(req.itemId)) continue;
      const a =
        map.get(req.itemId) ??
        { itemId: req.itemId, itemName: "", itemShort: "", total: 0, sources: [] };
      a.total += req.count;
      a.sources.push({ station: r.stationNormalizedName, stationName: r.stationName, level: r.level, count: req.count });
      map.set(req.itemId, a);
    }
  }

  const ids = [...map.keys()];
  if (ids.length > 0) {
    const itemRows = await db
      .select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName })
      .from(items)
      .where(and(eq(items.gameId, gameId), inArray(items.inGameId, ids)));
    const byId = new Map(itemRows.map((i) => [i.inGameId, i]));
    for (const a of map.values()) {
      const it = byId.get(a.itemId);
      a.itemName = it?.name ?? a.itemId;
      a.itemShort = it?.shortName ?? "";
    }
  }

  for (const a of map.values()) {
    a.sources.sort((x, y) => x.stationName.localeCompare(y.stationName) || x.level - y.level);
  }
  return [...map.values()].sort((x, y) => y.total - x.total || x.itemName.localeCompare(y.itemName));
}
