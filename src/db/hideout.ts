// Self-mirror требований апгрейдов убежища из tarkov.dev в нашу Supabase.
// Цены/имена НЕ храним — itemRequirements это {itemId, count}; подтянутся из
// `items` + `prices` при чтении («Важные предметы», гейты craft-profit).
//
// Источник трогает только syncEftHideout() — CLI `npm run db:sync-hideout`.
// Ключи (станция+уровень) стабильны между вайпами → чистый upsert без прюна.
// Импорты относительные (tsx-safe).
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  hideoutUpgrades,
  items,
  prices,
  type HideoutItemReq,
  type HideoutModuleReq,
  type HideoutTraderReq,
  type HideoutSkillReq,
} from "./schema";
import { eftGameId } from "./eft";
import { fetchMirrorRows, fetchTarkovJson } from "../lib/tarkov-fallback";
import { STATION_RU, traderLabelMap } from "../lib/tarkov-labels";

/* ───────────── строка БД + JSON-плоскость ───────────── */
interface HideoutRow {
  gameId: string;
  stationNormalizedName: string;
  stationName: string;
  level: number;
  constructionTime: number | null;
  itemRequirements: HideoutItemReq[];
  stationRequirements: HideoutModuleReq[];
  traderRequirements: HideoutTraderReq[];
  skillRequirements: HideoutSkillReq[];
}

interface JsonItemReq { item?: string; count?: number; attributes?: { foundInRaid?: boolean } | null }
interface JsonStationReq { station?: string; level?: number }
interface JsonTraderReq { trader?: string; value?: number } // level лежит в `value`
interface JsonSkillReq { skill?: string; level?: number }
interface JsonLevel {
  level?: number;
  constructionTime?: number;
  itemRequirements?: JsonItemReq[];
  stationLevelRequirements?: JsonStationReq[];
  traderRequirements?: JsonTraderReq[];
  skillRequirements?: JsonSkillReq[];
}
interface JsonStation { id?: string; name?: string; normalizedName?: string; levels?: JsonLevel[] }

async function hideoutFromJson(gameId: string): Promise<HideoutRow[]> {
  const [data, traders] = await Promise.all([
    fetchTarkovJson<Record<string, JsonStation>>("regular/hideout"),
    traderLabelMap(),
  ]);
  const stations = Object.values(data);
  // id станции → normalizedName (для резолва stationLevelRequirements, где станция дана id)
  const stationNn = new Map(stations.map((s) => [s.id ?? "", s.normalizedName ?? ""]));
  return stations.flatMap((st) =>
    (st.levels ?? [])
      .filter((lv) => lv.level != null)
      .map((lv) => ({
        gameId,
        stationNormalizedName: st.normalizedName ?? "-",
        // name из фида — locale-ключ ("hideout_area_7_name"); ru берём из STATION_RU.
        stationName: STATION_RU[st.normalizedName ?? ""] ?? st.normalizedName ?? "-",
        level: lv.level as number,
        constructionTime: lv.constructionTime ?? null,
        itemRequirements: (lv.itemRequirements ?? [])
          .filter((r): r is JsonItemReq & { item: string } => !!r.item)
          .map((r) => ({ itemId: r.item, count: r.count ?? 1, ...(r.attributes?.foundInRaid ? { fir: true } : {}) })),
        stationRequirements: (lv.stationLevelRequirements ?? [])
          .filter((r): r is JsonStationReq & { station: string } => !!r.station)
          .map((r) => ({ station: stationNn.get(r.station) ?? r.station, level: r.level ?? 1 })),
        traderRequirements: (lv.traderRequirements ?? [])
          .filter((r): r is JsonTraderReq & { trader: string } => !!r.trader)
          .map((r) => ({ trader: traders.get(r.trader)?.normalizedName ?? r.trader, level: r.value ?? 1 })),
        skillRequirements: (lv.skillRequirements ?? [])
          .filter((r): r is JsonSkillReq & { skill: string } => !!r.skill)
          .map((r) => ({ skill: r.skill, level: r.level ?? 1 })),
      })),
  );
}

export interface SyncHideoutResult {
  stations: number;
  upgrades: number;
}

/** Тянет апгрейды убежища (JSON-primary → GraphQL-fallback) и bulk-upsert'ит в `hideout_upgrades`. */
export async function syncEftHideout(): Promise<SyncHideoutResult> {
  const gameId = await eftGameId();
  const rows = await fetchMirrorRows<HideoutRow>(() => hideoutFromJson(gameId), "hideout");

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

  return { stations: new Set(rows.map((r) => r.stationNormalizedName)).size, upgrades: rows.length };
}

/* ───────────────── чтение для UI: агрегатор «нужно для убежища» ───────────────── */

// Валюты — не «собираемые» предметы, в шопинг-лист не включаем (₽/€/$).
// Экспорт: tracking-digest помечает валюту «стеком за 1 шт.» в дайджесте трекинга.
export const CURRENCY_IDS = new Set([
  "5449016a4bdc2d6f028b456f", // ₽ Roubles
  "569668774bdc2da2298b4568", // € Euros
  "5696686a4bdc2da3298b456a", // $ Dollars
]);

export interface HideoutNeedSource {
  station: string;
  stationName: string;
  level: number;
  count: number;
  /** Требуется «найдено в рейде». */
  fir?: boolean;
}
export interface HideoutNeed {
  itemId: string;
  itemName: string;
  itemShort: string;
  /** normalizedName из зеркала prices — для кросс-линка на карточку предмета. */
  slug?: string;
  /** Имя цвета слота (violet/blue/grey…) из prices — для фона ячейки по тарковской редкости. */
  backgroundColor?: string;
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
      a.sources.push({
        station: r.stationNormalizedName,
        stationName: r.stationName,
        level: r.level,
        count: req.count,
        ...(req.fir ? { fir: true } : {}),
      });
      map.set(req.itemId, a);
    }
  }

  const ids = [...map.keys()];
  if (ids.length > 0) {
    const [itemRows, priceRows] = await Promise.all([
      db
        .select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName })
        .from(items)
        .where(and(eq(items.gameId, gameId), inArray(items.inGameId, ids))),
      // slug (normalizedName) + backgroundColor (редкость слота) — кросс-линк + фон ячейки.
      db
        .select({ inGameId: prices.inGameId, normalizedName: prices.normalizedName, backgroundColor: prices.backgroundColor })
        .from(prices)
        .where(and(eq(prices.gameId, gameId), inArray(prices.inGameId, ids))),
    ]);
    const byId = new Map(itemRows.map((i) => [i.inGameId, i]));
    const priceById = new Map(priceRows.map((p) => [p.inGameId, p]));
    for (const a of map.values()) {
      const it = byId.get(a.itemId);
      a.itemName = it?.name ?? a.itemId;
      a.itemShort = it?.shortName ?? "";
      const p = priceById.get(a.itemId);
      if (p?.normalizedName) a.slug = p.normalizedName;
      if (p?.backgroundColor) a.backgroundColor = p.backgroundColor;
    }
  }

  for (const a of map.values()) {
    a.sources.sort((x, y) => x.stationName.localeCompare(y.stationName) || x.level - y.level);
  }
  return [...map.values()].sort((x, y) => y.total - x.total || x.itemName.localeCompare(y.itemName));
}

/* ───────────────── чтение для UI: фильтр «нужно мне» в каталоге ───────────────── */

export interface HideoutItemLevel {
  /** stationNormalizedName — совпадает с ключом useHideoutStore.levels */
  station: string;
  level: number;
  /** требуется «найдено в рейде» */
  fir?: boolean;
}

/**
 * Лёгкая карта `itemId → [{station, level}]`: где предмет требуется по уровням
 * станций. Без join'ов с именами/ценами (в отличие от getHideoutNeeds) — только
 * для фильтра «Нужно мне» в каталоге, где клиент сверяет level с построенным
 * уровнем из useHideoutStore. Валюта исключена. RSC-only.
 */
export async function getHideoutRequirementMap(): Promise<Record<string, HideoutItemLevel[]>> {
  const gameId = await eftGameId();
  const rows = await db
    .select({
      station: hideoutUpgrades.stationNormalizedName,
      level: hideoutUpgrades.level,
      itemRequirements: hideoutUpgrades.itemRequirements,
    })
    .from(hideoutUpgrades)
    .where(eq(hideoutUpgrades.gameId, gameId));

  const out: Record<string, HideoutItemLevel[]> = {};
  for (const r of rows) {
    for (const req of r.itemRequirements) {
      if (CURRENCY_IDS.has(req.itemId)) continue;
      (out[req.itemId] ??= []).push({
        station: r.station,
        level: r.level,
        ...(req.fir ? { fir: true } : {}),
      });
    }
  }
  return out;
}

/* ───────────────── чтение для UI: гейты разблокировки станций ───────────────── */

// normalizedName торговца → русское имя (для гейтов craft-profit). Стабильный набор.
const TRADER_RU: Record<string, string> = {
  prapor: "Прапор",
  therapist: "Терапевт",
  skier: "Лыжник",
  peacekeeper: "Миротворец",
  mechanic: "Механик",
  ragman: "Барахольщик",
  jaeger: "Егерь",
  fence: "Скупщик",
  ref: "Реф",
  lightkeeper: "Смотритель маяка",
  "btr-driver": "Водитель БТР",
};

export interface StationUnlock {
  stations: { nn: string; name: string; level: number }[]; // пререквизит-станции (nn для сверки built + иконка + рус. имя)
  traders: { nn: string; name: string; level: number }[]; // торговец (nn для аватара + рус. имя) + ЛВЛ
  skills: { id: string; name: string; level: number }[]; // id навыка (иконка SKILL_ICONS/имя SKILL_RU) + name (сырой id, для старых потребителей) + ЛВЛ
}
// Ключ — `${stationNormalizedName}|${level}`.
export type HideoutUnlockMap = Record<string, StationUnlock>;

/**
 * Карта требований разблокировки уровней станций (из `hideout_upgrades`) для гейтов
 * craft-profit. Имена пререквизит-станций берём из самих же строк (self-map). RSC-only.
 */
export async function getHideoutUnlockMap(): Promise<HideoutUnlockMap> {
  const gameId = await eftGameId();
  const rows = await db
    .select()
    .from(hideoutUpgrades)
    .where(eq(hideoutUpgrades.gameId, gameId));

  const stationRu = new Map(rows.map((r) => [r.stationNormalizedName, r.stationName]));
  const out: HideoutUnlockMap = {};
  for (const r of rows) {
    out[`${r.stationNormalizedName}|${r.level}`] = {
      stations: r.stationRequirements.map((s) => ({ nn: s.station, name: stationRu.get(s.station) ?? s.station, level: s.level })),
      traders: r.traderRequirements.map((t) => ({ nn: t.trader, name: TRADER_RU[t.trader] ?? t.trader, level: t.level })),
      skills: r.skillRequirements.map((s) => ({ id: s.skill, name: s.skill, level: s.level })),
    };
  }
  return out;
}

export interface HideoutStationInfo {
  normalizedName: string;
  name: string;
  maxLevel: number;
}

/** Канонический список станций убежища с максимальным уровнем (для сеттера «Моё убежище»). RSC-only. */
export async function getHideoutStations(): Promise<HideoutStationInfo[]> {
  const gameId = await eftGameId();
  const rows = await db
    .select({
      n: hideoutUpgrades.stationNormalizedName,
      name: hideoutUpgrades.stationName,
      level: hideoutUpgrades.level,
    })
    .from(hideoutUpgrades)
    .where(eq(hideoutUpgrades.gameId, gameId));

  const map = new Map<string, HideoutStationInfo>();
  for (const r of rows) {
    const e = map.get(r.n) ?? { normalizedName: r.n, name: r.name, maxLevel: 0 };
    e.maxLevel = Math.max(e.maxLevel, r.level);
    map.set(r.n, e);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
