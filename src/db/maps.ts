// Self-mirror ГЕОМЕТРИИ интерактивных карт EFT из tarkov.dev GraphQL (Map.{spawns,
// extracts,transits,locks,switches,hazards,lootContainers,lootLoose,stationaryWeapons,
// bosses}). Координаты — факты (лицензионно чистые, как prices). Картинки-подложки и
// параметры проекции живут отдельно (Storage + src/data/eft-map-config.ts).
//
// Источник трогает только syncEftMapsGeometry() — крон /api/cron/sync-prices и CLI
// `npm run db:sync-maps-geometry`. Импорты относительные (tsx-safe).
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  maps,
  mapAssets,
  mapMarkers,
  type NewMapMarkerRow,
  type MapAssetRow,
  type MapMarkerRow,
  type MapPos,
} from "./schema";
import { eftGameId } from "./eft";
import { pruneStale } from "./landing";
import { EFT_MAP_CONFIG } from "../data/eft-map-config";
import { fetchTarkovGraphQL } from "../lib/tarkov-fallback";

// НЕ удаляем стейл-маркеры, если свежий набор для карты меньше этой доли уже лежащего —
// страховка от частичного/обрезанного ответа источника (HTTP 200, но усечённый список).
const PRUNE_MIN_RATIO = 0.5;

/* ───────────────── сырой ответ API (без any; формы сверены интроспекцией 2026-06-23) ───────────────── */
interface RawPos {
  x: number;
  y: number;
  z: number;
}
interface RawSwitchRef {
  id: string;
  name?: string | null;
}
interface RawContained {
  item: { id: string; name: string } | null;
  count: number;
}
interface RawExtract {
  id: string;
  name?: string | null;
  faction?: string | null;
  switches?: RawSwitchRef[] | null;
  transferItem?: RawContained | null;
  position?: RawPos | null;
  outline?: RawPos[] | null;
  top?: number | null;
  bottom?: number | null;
}
interface RawTransit {
  id: string;
  description?: string | null;
  conditions?: string | null;
  position?: RawPos | null;
  outline?: RawPos[] | null;
  top?: number | null;
  bottom?: number | null;
}
interface RawLock {
  lockType?: string | null;
  key?: { id: string; name: string; normalizedName: string } | null;
  needsPower?: boolean | null;
  position?: RawPos | null;
  outline?: RawPos[] | null;
  top?: number | null;
  bottom?: number | null;
}
interface RawSwitchTarget {
  __typename: string;
  id?: string | null;
  name?: string | null;
}
interface RawSwitchOp {
  operation?: string | null;
  target?: RawSwitchTarget | null;
}
interface RawSwitch {
  id: string;
  name?: string | null;
  switchType?: string | null;
  activatedBy?: { id: string } | null;
  activates?: RawSwitchOp[] | null;
  position?: RawPos | null;
}
interface RawHazard {
  hazardType?: string | null;
  name?: string | null;
  position?: RawPos | null;
  outline?: RawPos[] | null;
  top?: number | null;
  bottom?: number | null;
}
interface RawSpawn {
  zoneName?: string | null;
  position: RawPos;
  sides?: string[] | null;
  categories?: string[] | null;
}
interface RawLootContainer {
  lootContainer?: { id: string; name: string; normalizedName: string } | null;
  position?: RawPos | null;
}
interface RawLootLoose {
  items?: { id: string; name: string }[] | null;
  position?: RawPos | null;
}
interface RawStationary {
  stationaryWeapon?: { id: string; name: string } | null;
  position?: RawPos | null;
}
interface RawBossEscortAmount {
  count: number;
  chance: number;
}
interface RawBossEscort {
  boss?: { id: string; name: string } | null;
  amount?: RawBossEscortAmount[] | null;
}
interface RawBossSpawnLocation {
  spawnKey: string;
  name: string;
  chance: number;
}
interface RawBoss {
  boss?: { id: string; name: string; normalizedName: string } | null;
  spawnChance?: number | null;
  spawnTime?: number | null;
  spawnTrigger?: string | null;
  spawnLocations?: RawBossSpawnLocation[] | null;
  escorts?: RawBossEscort[] | null;
  switch?: { id: string } | null;
}
interface RawMap {
  id: string;
  tarkovDataId?: string | null;
  name: string;
  normalizedName: string;
  raidDuration?: number | null;
  players?: string | null;
  minPlayerLevel?: number | null;
  maxPlayerLevel?: number | null;
  bosses?: RawBoss[] | null;
  spawns?: RawSpawn[] | null;
  extracts?: RawExtract[] | null;
  transits?: RawTransit[] | null;
  locks?: RawLock[] | null;
  switches?: RawSwitch[] | null;
  hazards?: RawHazard[] | null;
  lootContainers?: RawLootContainer[] | null;
  lootLoose?: RawLootLoose[] | null;
  stationaryWeapons?: RawStationary[] | null;
}
// Запрос сверён против живой схемы (интроспекция + прогон, 0 ошибок полей, 2026-06-23).
// transit.map (карта-назначение) НЕ запрашиваем — резолвер падает на битых ссылках в данных
// источника; destination добавим в v2 при необходимости.
const QUERY = `
  query {
    maps(lang: ru) {
      id tarkovDataId name normalizedName raidDuration players minPlayerLevel maxPlayerLevel
      bosses {
        boss { id name normalizedName }
        spawnChance spawnTime spawnTrigger
        spawnLocations { spawnKey name chance }
        escorts { boss { id name } amount { count chance } }
        switch { id }
      }
      spawns { zoneName position { x y z } sides categories }
      extracts {
        id name faction
        switches { id name }
        transferItem { item { id name } count }
        position { x y z } outline { x y z } top bottom
      }
      transits { id description conditions position { x y z } outline { x y z } top bottom }
      locks {
        lockType key { id name normalizedName } needsPower
        position { x y z } outline { x y z } top bottom
      }
      switches {
        id name switchType activatedBy { id }
        activates { operation target { __typename ... on MapSwitch { id name } ... on MapExtract { id name } } }
        position { x y z }
      }
      hazards { hazardType name position { x y z } outline { x y z } top bottom }
      lootContainers { lootContainer { id name normalizedName } position { x y z } }
      lootLoose { items { id name } position { x y z } }
      stationaryWeapons { stationaryWeapon { id name } position { x y z } }
    }
  }
`;

/* ───────────────── стабильные id маркеров без GraphQL-id ───────────────── */
// 64-битный FNV-1a (две ленты с разными seed) → коллизии на ~18k маркеров пренебрежимы.
function hash64(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xc2b2ae35;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
const posKey = (p?: RawPos | null): string => (p ? `${p.x},${p.y},${p.z}` : "");
const pos = (p?: RawPos | null): MapPos | null => (p ? { x: p.x, y: p.y, z: p.z } : null);

/** Раскладывает одну карту в плоский список маркеров (зеркало источника 1:1). */
function markersForMap(m: RawMap, gameId: string): NewMapMarkerRow[] {
  const rows: NewMapMarkerRow[] = [];
  // synth-id: type входит в хеш → разные типы на одной точке не сталкиваются; mapId → уникальность между картами.
  const sid = (type: string, key: string): string => `${type}_${hash64(`${m.id}|${type}|${key}`)}`;

  for (const e of m.extracts ?? []) {
    if (!e.id) continue;
    rows.push({
      mapId: m.id, id: e.id, gameId, type: "extract",
      position: pos(e.position), outline: (e.outline ?? []).map((p) => ({ x: p.x, y: p.y, z: p.z })),
      top: e.top ?? null, bottom: e.bottom ?? null,
      label: e.name ?? null, faction: e.faction ?? null, sides: null, categories: null,
      linkedItemId: e.transferItem?.item?.id ?? null, linkedQuestId: null,
      meta: {
        switches: (e.switches ?? []).map((s) => ({ id: s.id, name: s.name ?? null })),
        transferItem: e.transferItem?.item
          ? { id: e.transferItem.item.id, name: e.transferItem.item.name, count: e.transferItem.count }
          : null,
      },
    });
  }
  for (const s of m.spawns ?? []) {
    if (!s.position) continue;
    rows.push({
      // ключ из ВСЕХ хранимых полей → коллизия = строки реально идентичны (схлопывание без потерь).
      mapId: m.id, id: sid("spawn", `${posKey(s.position)}|${s.zoneName ?? ""}|${(s.sides ?? []).join(",")}|${(s.categories ?? []).join(",")}`), gameId, type: "spawn",
      position: pos(s.position), outline: null, top: null, bottom: null,
      label: s.zoneName ?? null, faction: null, sides: s.sides ?? null, categories: s.categories ?? null,
      linkedItemId: null, linkedQuestId: null, meta: null,
    });
  }
  for (const t of m.transits ?? []) {
    if (!t.id) continue;
    rows.push({
      mapId: m.id, id: t.id, gameId, type: "transit",
      position: pos(t.position), outline: (t.outline ?? []).map((p) => ({ x: p.x, y: p.y, z: p.z })),
      top: t.top ?? null, bottom: t.bottom ?? null,
      label: t.description ?? null, faction: null, sides: null, categories: null,
      linkedItemId: null, linkedQuestId: null,
      meta: { description: t.description ?? null, conditions: t.conditions ?? null },
    });
  }
  for (const h of m.hazards ?? []) {
    rows.push({
      mapId: m.id, id: sid("hazard", `${posKey(h.position)}|${h.name ?? ""}|${h.hazardType ?? ""}`), gameId, type: "hazard",
      position: pos(h.position), outline: (h.outline ?? []).map((p) => ({ x: p.x, y: p.y, z: p.z })),
      top: h.top ?? null, bottom: h.bottom ?? null,
      label: h.name ?? null, faction: null, sides: null, categories: null,
      linkedItemId: null, linkedQuestId: null, meta: { hazardType: h.hazardType ?? null },
    });
  }
  for (const l of m.locks ?? []) {
    rows.push({
      mapId: m.id, id: sid("lock", `${posKey(l.position)}|${l.key?.id ?? ""}|${l.lockType ?? ""}|${l.needsPower ?? ""}`), gameId, type: "lock",
      position: pos(l.position), outline: (l.outline ?? []).map((p) => ({ x: p.x, y: p.y, z: p.z })),
      top: l.top ?? null, bottom: l.bottom ?? null,
      label: l.key?.name ?? null, faction: null, sides: null, categories: null,
      linkedItemId: l.key?.id ?? null, linkedQuestId: null,
      meta: { lockType: l.lockType ?? null, needsPower: l.needsPower ?? null, key: l.key ?? null },
    });
  }
  for (const sw of m.switches ?? []) {
    if (!sw.id) continue;
    rows.push({
      mapId: m.id, id: sw.id, gameId, type: "switch",
      position: pos(sw.position), outline: null, top: null, bottom: null,
      label: sw.name ?? null, faction: null, sides: null, categories: null,
      linkedItemId: null, linkedQuestId: null,
      meta: {
        switchType: sw.switchType ?? null,
        activatedBy: sw.activatedBy?.id ?? null,
        activates: (sw.activates ?? []).map((a) => ({
          operation: a.operation ?? null,
          target: a.target ? { type: a.target.__typename, id: a.target.id ?? null, name: a.target.name ?? null } : null,
        })),
      },
    });
  }
  for (const lc of m.lootContainers ?? []) {
    rows.push({
      mapId: m.id, id: sid("loot_container", `${posKey(lc.position)}|${lc.lootContainer?.id ?? ""}`), gameId, type: "loot_container",
      position: pos(lc.position), outline: null, top: null, bottom: null,
      label: lc.lootContainer?.name ?? null, faction: null, sides: null, categories: null,
      linkedItemId: lc.lootContainer?.id ?? null, linkedQuestId: null, meta: null,
    });
  }
  for (const ll of m.lootLoose ?? []) {
    const first = ll.items?.[0];
    rows.push({
      mapId: m.id, id: sid("loot_loose", `${posKey(ll.position)}|${(ll.items ?? []).map((i) => i.id).join(",")}`), gameId, type: "loot_loose",
      position: pos(ll.position), outline: null, top: null, bottom: null,
      label: first?.name ?? null, faction: null, sides: null, categories: null,
      linkedItemId: first?.id ?? null, linkedQuestId: null,
      meta: ll.items && ll.items.length > 1 ? { items: ll.items.map((i) => ({ id: i.id, name: i.name })) } : null,
    });
  }
  for (const st of m.stationaryWeapons ?? []) {
    rows.push({
      mapId: m.id, id: sid("stationary_weapon", `${posKey(st.position)}|${st.stationaryWeapon?.id ?? ""}`), gameId, type: "stationary_weapon",
      position: pos(st.position), outline: null, top: null, bottom: null,
      label: st.stationaryWeapon?.name ?? null, faction: null, sides: null, categories: null,
      linkedItemId: st.stationaryWeapon?.id ?? null, linkedQuestId: null, meta: null,
    });
  }
  for (const b of m.bosses ?? []) {
    if (!b.boss?.id) continue;
    rows.push({
      // боссы — спавн по зоне без точных координат; пин ставится кросс-референсом spawnLocations → spawn.zoneName (v2).
      mapId: m.id, id: `boss_${b.boss.id}`, gameId, type: "boss",
      position: null, outline: null, top: null, bottom: null,
      label: b.boss.name ?? null, faction: null, sides: null, categories: null,
      linkedItemId: null, linkedQuestId: null,
      meta: {
        bossNormalizedName: b.boss.normalizedName ?? null,
        spawnChance: b.spawnChance ?? null,
        spawnTime: b.spawnTime ?? null,
        spawnTrigger: b.spawnTrigger ?? null,
        spawnLocations: b.spawnLocations ?? [],
        escorts: (b.escorts ?? []).map((es) => ({
          id: es.boss?.id ?? null,
          name: es.boss?.name ?? null,
          amount: es.amount ?? [],
        })),
        switchId: b.switch?.id ?? null,
      },
    });
  }
  return rows;
}

export interface SyncMapsResult {
  maps: number;
  assets: number;
  markers: number;
  markersDeleted: number;
  assetsDeleted: number;
  markersPruneSkipped: number; // число карт, у которых прюн пропущен (частичный ответ?)
  assetsPruneSkipped: boolean;
}

/** Тянет геометрию всех карт из tarkov.dev и зеркалит в maps/map_assets/map_markers. */
export async function syncEftMapsGeometry(): Promise<SyncMapsResult> {
  // GraphQL-primary. JSON-плоскость (/maps) сюда НЕ адаптируем: её структура геометрии
  // (mobs/goonReports/lootContainers) сильно расходится с Map.{spawns,extracts,…}, а
  // адаптер всей геометрии — непропорциональный риск на координатных данных. Геометрия
  // меняется раз в вайп и защищена «не затираем при пустоте» — даун GraphQL просто не обновляет.
  const data = await fetchTarkovGraphQL<{ maps?: RawMap[] }>(QUERY);
  const all = (data.maps ?? []).filter((m) => m.id && m.normalizedName);
  if (all.length === 0) throw new Error("maps пусто — синк отменён (старые данные сохранены)");

  const gameId = await eftGameId();

  // 1) maps — самодостаточный upsert (гарантирует FK для map_assets/map_markers независимо от порядка синков).
  await db
    .insert(maps)
    .values(all.map((m) => ({ id: m.id, gameId, name: m.name, normalizedName: m.normalizedName })))
    .onConflictDoUpdate({
      target: maps.id,
      set: { name: sql`excluded.name`, normalizedName: sql`excluded.normalized_name`, syncedAt: sql`now()` },
    });

  // 2) map_assets — метаданные карты + указатель на SVG-подложку + атрибуция (из статик-конфига).
  await db
    .insert(mapAssets)
    .values(
      all.map((m) => {
        const cfg = EFT_MAP_CONFIG[m.normalizedName];
        return {
          mapId: m.id,
          gameId,
          normalizedName: m.normalizedName,
          // Статичные карты (наш арт в /public) НЕ зеркалятся в Storage → imageKey null,
          // чтобы они не попадали в БД-индекс интерактивных карт (рендерятся отдельной веткой).
          imageKey: cfg?.svgFile && !cfg.staticMap ? `maps/eft/${m.normalizedName}.svg` : null,
          imageFormat: cfg?.svgFile && !cfg.staticMap ? "svg" : null,
          author: cfg?.author ?? null,
          authorLink: cfg?.authorLink ?? null,
          raidDuration: m.raidDuration ?? null,
          players: m.players ?? null,
          minPlayerLevel: m.minPlayerLevel ?? null,
          maxPlayerLevel: m.maxPlayerLevel ?? null,
        };
      }),
    )
    .onConflictDoUpdate({
      target: mapAssets.mapId,
      set: {
        normalizedName: sql`excluded.normalized_name`,
        imageKey: sql`excluded.image_key`,
        imageFormat: sql`excluded.image_format`,
        author: sql`excluded.author`,
        authorLink: sql`excluded.author_link`,
        raidDuration: sql`excluded.raid_duration`,
        players: sql`excluded.players`,
        minPlayerLevel: sql`excluded.min_player_level`,
        maxPlayerLevel: sql`excluded.max_player_level`,
        syncedAt: sql`now()`,
      },
    });

  // 3) map_markers — вся геометрия. Дедуп по (mapId,id) ПЕРЕД вставкой: байт-идентичные
  // дубли источника дают один id (схлопывание lossless, проверено), но Postgres ON CONFLICT
  // не может обновить одну строку дважды в одном INSERT ("cannot affect row a second time").
  const rawRows = all.flatMap((m) => markersForMap(m, gameId));
  const dedup = new Map<string, NewMapMarkerRow>();
  for (const r of rawRows) dedup.set(`${r.mapId} ${r.id}`, r);
  const markerRows = [...dedup.values()];
  const CHUNK = 500;
  for (let i = 0; i < markerRows.length; i += CHUNK) {
    await db
      .insert(mapMarkers)
      .values(markerRows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [mapMarkers.mapId, mapMarkers.id],
        set: {
          type: sql`excluded.type`,
          position: sql`excluded.position`,
          outline: sql`excluded.outline`,
          top: sql`excluded.top`,
          bottom: sql`excluded.bottom`,
          label: sql`excluded.label`,
          faction: sql`excluded.faction`,
          sides: sql`excluded.sides`,
          categories: sql`excluded.categories`,
          linkedItemId: sql`excluded.linked_item_id`,
          linkedQuestId: sql`excluded.linked_quest_id`,
          meta: sql`excluded.meta`,
          syncedAt: sql`now()`,
        },
      });
  }

  // 4) прюн стейл-маркеров — per-map (PK composite, прюним в скоупе карты + гард ratio).
  const keepByMap = new Map<string, string[]>();
  for (const r of markerRows) {
    const arr = keepByMap.get(r.mapId);
    if (arr) arr.push(r.id);
    else keepByMap.set(r.mapId, [r.id]);
  }
  let markersDeleted = 0;
  let markersPruneSkipped = 0;
  for (const [mapId, keep] of keepByMap) {
    const had = await db.$count(mapMarkers, eq(mapMarkers.mapId, mapId));
    if (keep.length < had * PRUNE_MIN_RATIO) {
      markersPruneSkipped++;
      console.warn(`[maps] прюн маркеров ${mapId} пропущен: свежих ${keep.length} << в БД ${had}`);
      continue;
    }
    const del = await db.delete(mapMarkers).where(and(eq(mapMarkers.mapId, mapId), notInArray(mapMarkers.id, keep)));
    markersDeleted += del.count;
  }

  // 5) прюн стейл-ассетов (карты, исчезнувшие из источника) — переиспользуем pruneStale.
  const aP = await pruneStale(mapAssets, mapAssets.mapId, mapAssets.gameId, gameId, all.map((m) => m.id), "map_assets");

  return {
    maps: all.length,
    assets: all.length,
    markers: markerRows.length,
    markersDeleted,
    assetsDeleted: aP.deleted,
    markersPruneSkipped,
    assetsPruneSkipped: aP.skipped,
  };
}

/* ───────────────── читалки (рантайм, чистое чтение нашей БД) ───────────────── */

/** Карта (+ru-имя из maps) и её маркеры для страницы /eft/maps/[slug]. null — нет данных. */
export async function getEftMapData(
  slug: string,
): Promise<{ asset: MapAssetRow; name: string; markers: MapMarkerRow[] } | null> {
  try {
    const gameId = await eftGameId();
    const [row] = await db
      .select({ asset: mapAssets, name: maps.name })
      .from(mapAssets)
      .innerJoin(maps, eq(maps.id, mapAssets.mapId))
      .where(and(eq(mapAssets.gameId, gameId), eq(mapAssets.normalizedName, slug)))
      .limit(1);
    if (!row) return null;
    const markers = await db.select().from(mapMarkers).where(eq(mapMarkers.mapId, row.asset.mapId));
    return { asset: row.asset, name: row.name, markers };
  } catch (e) {
    console.error("[getEftMapData]", e);
    return null;
  }
}

/** Все карты с интерактивной подложкой (imageKey задан) — для индекса /eft/maps. */
export async function getEftInteractiveMaps(): Promise<MapAssetRow[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db.select().from(mapAssets).where(eq(mapAssets.gameId, gameId));
    return rows.filter((r) => r.imageKey);
  } catch (e) {
    console.error("[getEftInteractiveMaps]", e);
    return [];
  }
}

/* ───────────────── зоны объективов квестов → map_markers (quest_zone) ───────────────── */
// Координаты зон (TaskZone) — факты, как и геометрия карт. Только этот синк (крон/CLI)
// ходит в tarkov.dev (правило 11). Изолирован от syncEftMapsGeometry: свой прюн по
// type='quest_zone' + гард на пустой ответ. Поля сверены интроспекцией (2026-06-24).
const QUEST_ZONES_QUERY = `
  query {
    tasks(lang: ru) {
      id name
      objectives {
        id
        ... on TaskObjectiveBasic     { zones { id map { normalizedName } position { x y z } outline { x y z } top bottom } }
        ... on TaskObjectiveItem      { zones { id map { normalizedName } position { x y z } outline { x y z } top bottom } }
        ... on TaskObjectiveMark      { zones { id map { normalizedName } position { x y z } outline { x y z } top bottom } }
        ... on TaskObjectiveQuestItem { zones { id map { normalizedName } position { x y z } outline { x y z } top bottom } }
        ... on TaskObjectiveShoot     { zones { id map { normalizedName } position { x y z } outline { x y z } top bottom } }
      }
    }
  }
`;

interface RawZone {
  id: string;
  map?: { normalizedName: string } | null;
  position?: RawPos | null;
  outline?: RawPos[] | null;
  top?: number | null;
  bottom?: number | null;
}
interface RawObjectiveZones {
  id: string;
  zones?: RawZone[] | null;
}
interface RawTaskZones {
  id: string;
  name: string;
  objectives?: RawObjectiveZones[] | null;
}
/** Базовый slug карты: срезаем суффиксы вариантов рейда (день/ночь/21+). */
const baseSlug = (s: string): string => s.replace(/-(21|day|night)$/i, "");

export interface SyncQuestZonesResult {
  zones: number;
  deleted: number;
  pruneSkipped: boolean;
}

/**
 * Зеркалит координаты зон объективов квестов в map_markers (type='quest_zone',
 * linkedQuestId=taskId). Привязка — к интерактивной карте по базовому slug. Питает кнопку
 * «Посмотреть на карте» (перелёт+подсветка зоны). type — свободный text, db:push НЕ нужен.
 */
export async function syncEftQuestZones(): Promise<SyncQuestZonesResult> {
  const data = await fetchTarkovGraphQL<{ tasks?: RawTaskZones[] }>(QUEST_ZONES_QUERY);
  const gameId = await eftGameId();

  // base-slug → mapId, только интерактивные карты (imageKey задан); зоны вне их игнорируем.
  const assetRows = await db
    .select({ slug: mapAssets.normalizedName, mapId: mapAssets.mapId, imageKey: mapAssets.imageKey })
    .from(mapAssets)
    .where(eq(mapAssets.gameId, gameId));
  const slugToId = new Map<string, string>();
  for (const r of assetRows) if (r.imageKey) slugToId.set(r.slug, r.mapId);

  const dedup = new Map<string, NewMapMarkerRow>();
  for (const t of data.tasks ?? []) {
    for (const o of t.objectives ?? []) {
      for (const z of o.zones ?? []) {
        if (!z.position || !z.map?.normalizedName) continue;
        const mapId = slugToId.get(baseSlug(z.map.normalizedName));
        if (!mapId) continue;
        const id = `qz_${hash64(`${t.id}|${z.id}|${mapId}`)}`;
        dedup.set(`${mapId} ${id}`, {
          mapId,
          id,
          gameId,
          type: "quest_zone",
          position: { x: z.position.x, y: z.position.y, z: z.position.z },
          outline: (z.outline ?? []).map((p) => ({ x: p.x, y: p.y, z: p.z })),
          top: z.top ?? null,
          bottom: z.bottom ?? null,
          label: t.name,
          faction: null,
          sides: null,
          categories: null,
          linkedItemId: null,
          linkedQuestId: t.id,
          meta: { zoneId: z.id },
        });
      }
    }
  }

  const rows = [...dedup.values()];
  // Пусто → НЕ прюним (страховка от обрезанного ответа), старые зоны сохраняем.
  if (rows.length === 0) return { zones: 0, deleted: 0, pruneSkipped: true };

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(mapMarkers)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [mapMarkers.mapId, mapMarkers.id],
        set: {
          type: sql`excluded.type`,
          position: sql`excluded.position`,
          outline: sql`excluded.outline`,
          top: sql`excluded.top`,
          bottom: sql`excluded.bottom`,
          label: sql`excluded.label`,
          linkedQuestId: sql`excluded.linked_quest_id`,
          meta: sql`excluded.meta`,
          syncedAt: sql`now()`,
        },
      });
  }

  // Прюн стейл quest_zone (скоуп type='quest_zone' по игре).
  const keepIds = rows.map((r) => r.id);
  const del = await db
    .delete(mapMarkers)
    .where(and(eq(mapMarkers.gameId, gameId), eq(mapMarkers.type, "quest_zone"), notInArray(mapMarkers.id, keepIds)));

  return { zones: rows.length, deleted: del.count, pruneSkipped: false };
}

export interface InteractiveMapNav {
  slug: string;        // normalizedName
  name: string;        // ru-имя из maps
}

/**
 * Интерактивные карты (imageKey задан) + ru-имя — динамический источник для индекса
 * /eft/maps и навигации по разделу. Добавили/убрали карту в БД → список сам обновился.
 */
export async function getEftInteractiveMapsWithNames(): Promise<InteractiveMapNav[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db
      .select({ slug: mapAssets.normalizedName, name: maps.name, imageKey: mapAssets.imageKey })
      .from(mapAssets)
      .innerJoin(maps, eq(maps.id, mapAssets.mapId))
      .where(eq(mapAssets.gameId, gameId));
    return rows.filter((r) => r.imageKey).map((r) => ({ slug: r.slug, name: r.name }));
  } catch (e) {
    console.error("[getEftInteractiveMapsWithNames]", e);
    return [];
  }
}
