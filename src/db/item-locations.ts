// Ридер «Где найти предмет» (item-центричный): реверс единой `markers` (loose-точки предмета +
// позиции контейнеров) + реверс `container-loot.json` (в каких типах контейнеров встречается).
// Спина = live-маркеры tarkov.dev за нашим кроном (§4.11/§4.12); SPT — ТОЛЬКО контейнерное членство.
// Читает и sync, и user (ручные точки переживают синк — cron prune только source='sync', unified-markers).
// Данные ≈ на патч. Решение: docs/decisions/where-to-find-item.md (A–H).
import { and, eq, or, inArray, isNotNull } from "drizzle-orm";
import { db } from "./index";
import { markers } from "./schema-markers";
import { maps } from "./schema";
import { eftGameId } from "./eft";
import { LOOT_CONTAINERS, type LootContainerKind } from "@/data/loot-containers";
import { getContainerLoot } from "@/data/loot/container-loot";
import { LOOT_15, classifyLoot15 } from "@/data/map-markers/loot-15";
import { getMapConfig } from "@/data/eft-map-config";

export interface MapCount {
  /** Слаг роута карты (= maps.normalizedName) для /eft/maps/<mapId> — НЕ maps.id. */
  mapId: string;
  mapName: string;
  count: number;
}

export interface ContainerLocation {
  slug: string;
  nameRu: string;
  /** Ключ арт-файла == суффикс слоя карты `container-<file>` (для deep-link фильтра). */
  file: string;
  kind: LootContainerKind;
  /** Шанс появления предмета в этом типе контейнера, % (SPT staticLoot). */
  prob: number;
  /** Позиции по картам (из наших маркеров), «лучшая карта» сверху. */
  maps: MapCount[];
  total: number;
}

export interface ItemLocations {
  /** Категория лута предмета (одна из 15) — для тумблера «+ категория» на карте. */
  category: { key: string; label: string; icon: string } | null;
  /** Карты с loose-точками предмета, ранжировано по числу точек (лучшие сверху). */
  looseMaps: MapCount[];
  /** Типы контейнеров, где встречается предмет, ранжировано по числу позиций. */
  containers: ContainerLocation[];
  /** Гейт секции (F): есть ли вообще где показывать. */
  hasData: boolean;
}

/** Coarse-флаг для classifyLoot15 из item.types (для барти категория берётся по bsgCategoryId). */
const COARSE_TYPES = ["barter", "provisions", "injectors", "keys", "poster"] as const;

/**
 * Собрать «где найти» для предмета. Спина — live-`markers`; контейнерное членство — `container-loot.json`.
 * @param tpl BSG item id (items.inGameId == tarkov.dev id == marker.linkedItemId у loose).
 */
export async function getItemLocations(opts: {
  tpl: string;
  types?: string[] | null;
  bsgCategoryId?: string | null;
}): Promise<ItemLocations> {
  const { tpl } = opts;
  const gameId = await eftGameId();

  // — Категория лута (реюз той же classifyLoot15, что раскладывает loose на карте) —
  const coarse = (opts.types ?? []).find((t) => (COARSE_TYPES as readonly string[]).includes(t)) ?? null;
  const catKey = classifyLoot15(coarse, opts.bsgCategoryId ?? null);
  const catDef = LOOT_15.find((c) => c.key === catKey) ?? null;
  const category = catDef ? { key: catDef.key, label: catDef.label, icon: catDef.icon } : null;

  // — Контейнерное членство: реверс container-loot по slug (airdrop/special — вон, D) —
  const membership = LOOT_CONTAINERS.flatMap((c) => {
    if (c.kind === "special") return [];
    const row = getContainerLoot(c.slug)?.items.find((i) => i.tpl === tpl);
    return row ? [{ slug: c.slug, nameRu: c.nameRu, file: c.file, kind: c.kind, prob: row.prob }] : [];
  });
  const nameRus = membership.map((m) => m.nameRu);

  // — Маркеры: loose-точки самого предмета (sync loot_loose + user editorial loot) —
  const looseRows = await db
    .select({ mapId: markers.mapId })
    .from(markers)
    .where(
      and(
        eq(markers.gameId, gameId),
        isNotNull(markers.x),
        eq(markers.hidden, false),
        or(
          and(eq(markers.type, "loot_loose"), eq(markers.linkedItemId, tpl)),
          and(eq(markers.type, "loot"), eq(markers.category, tpl)),
        ),
      ),
    );

  // — Маркеры: позиции контейнеров нужных типов (джойн по label == nameRu каталога) —
  const containerRows = nameRus.length
    ? await db
        .select({ mapId: markers.mapId, label: markers.label })
        .from(markers)
        .where(
          and(
            eq(markers.gameId, gameId),
            eq(markers.hidden, false),
            inArray(markers.type, ["loot_container", "container"]),
            inArray(markers.label, nameRus),
          ),
        )
    : [];

  // — Карты: маркеры ссылаются на maps.id, а РОУТ /eft/maps/<slug> ждёт maps.normalizedName.
  //   Фильтруем на карты с интерактивным конфигом — иначе ссылка ведёт в 404.
  const mapRows = await db
    .select({ id: maps.id, name: maps.name, slug: maps.normalizedName })
    .from(maps)
    .where(eq(maps.gameId, gameId));
  const mapInfo = new Map(
    mapRows
      .filter((m) => getMapConfig(m.slug))
      .map((m) => [m.id, { name: m.name, slug: m.slug }] as [string, { name: string; slug: string }]),
  );
  // maps.id → MapCount[] со слагом роута (normalizedName). Группируем ПО СЛАГУ и суммируем:
  // разные maps.id могут делить один слаг (напр. factory + дормантный factory-hd) → одна карта.
  const toMapCounts = (byId: Map<string, number>): MapCount[] => {
    const bySlug = new Map<string, { name: string; count: number }>();
    for (const [id, count] of byId) {
      const info = mapInfo.get(id);
      if (!info) continue; // карта без интерактивного роута — пропускаем (иначе 404)
      const cur = bySlug.get(info.slug);
      if (cur) cur.count += count;
      else bySlug.set(info.slug, { name: info.name, count });
    }
    return [...bySlug.entries()]
      .map(([slug, v]) => ({ mapId: slug, mapName: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count);
  };

  // — Агрегация loose по карте, «лучшая» сверху —
  const looseByMap = new Map<string, number>();
  for (const r of looseRows) looseByMap.set(r.mapId, (looseByMap.get(r.mapId) ?? 0) + 1);
  const looseMaps = toMapCounts(looseByMap);

  // — Агрегация контейнеров: label → (mapId → count) —
  const byLabel = new Map<string, Map<string, number>>();
  for (const r of containerRows) {
    if (!r.label) continue;
    let mm = byLabel.get(r.label);
    if (!mm) byLabel.set(r.label, (mm = new Map()));
    mm.set(r.mapId, (mm.get(r.mapId) ?? 0) + 1);
  }
  const containers: ContainerLocation[] = membership
    .map((m) => {
      const mapsArr = toMapCounts(byLabel.get(m.nameRu) ?? new Map<string, number>());
      return { slug: m.slug, nameRu: m.nameRu, file: m.file, kind: m.kind, prob: m.prob, maps: mapsArr, total: mapsArr.reduce((s, x) => s + x.count, 0) };
    })
    .sort((a, b) => b.total - a.total);

  // Гейт (F): предмет присутствует в loose-точках ИЛИ в каком-либо контейнер-пуле.
  const hasData = looseMaps.length > 0 || membership.length > 0;
  return { category, looseMaps, containers, hasData };
}
