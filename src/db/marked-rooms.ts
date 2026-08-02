// Ридер меченых/цветных комнат для страницы /eft/maps/<map>/rooms/<slug>.
// Решение: docs/decisions/marked-rooms.md (Фаза 2). Данные: marked_rooms + markers (якорь-замок) +
// loot_spawns (лут в радиусе вокруг замка — подтверждено пробой; полигон уточнит границы позже) +
// живые цены (prices). EV/шанс считаются ЗДЕСЬ (сервер), как в loot-heat.ts.
//
// Импорты относительные (не @/) — модуль читается и из RSC, и под tsx-скриптом (как prices.ts).
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { games, maps, lootSpawns, type LootPoolEntry } from "./schema";
import { markers } from "./schema-markers";
import { markedRooms, type MarkedRoomRow } from "./schema-marked-rooms";
import { getEftPriceMapFromDb } from "./prices";
import { getEftCatalog } from "../lib/eft-catalog";

/** Радиус (в игровых метрах) вокруг замка, из которого берём loose-лут комнаты (черновой срез до полигона). */
export const ROOM_LOOT_RADIUS = 12;
/** Сколько позиций лут-таблицы отдаём (топ по матожиданию). */
const LOOT_TOP_N = 24;

export interface RoomLootItem {
  itemId: string;
  name: string;
  shortName: string;
  backgroundColor: string | null; // цвет фона слота (редкость), из зеркала цен
  chance: number;                 // P(предмет появится ≥1 раз в комнате), 0..1
  price: number;                  // цена за штуку (live)
  ev: number;                     // вклад в матожидание ₽
}

export interface MarkedRoomKey {
  id: string;
  name: string;
  shortName: string;
  price: number | null; // live-цена ключа; null — не в зеркале цен
}

export interface MarkedRoomVerdict {
  keyPrice: number;
  sumEv: number;
  net: number;        // sumEv − keyPrice
  profitable: boolean;
}

export interface MarkedRoomView {
  room: MarkedRoomRow;
  mapSlug: string;
  mapName: string;
  anchor: { x: number; z: number } | null; // позиция замка (центр радиуса)
  key: MarkedRoomKey | null;
  loot: RoomLootItem[];
  sumEv: number;
  verdict: MarkedRoomVerdict | null; // null, если цена ключа неизвестна
}

/** Лёгкий список комнат карты (для подсветки/ссылок на странице карты). */
export async function getMarkedRoomsForMap(mapId: string): Promise<MarkedRoomRow[]> {
  const [eft] = await db.select().from(games).where(eq(games.code, "eft"));
  if (!eft) return [];
  return db
    .select()
    .from(markedRooms)
    .where(and(eq(markedRooms.gameId, eft.id), eq(markedRooms.mapId, mapId)));
}

/** Полное представление комнаты по slug карты + slug комнаты. null — не найдена. */
export async function getMarkedRoomBySlug(mapSlug: string, roomSlug: string): Promise<MarkedRoomView | null> {
  const [eft] = await db.select().from(games).where(eq(games.code, "eft"));
  if (!eft) return null;

  const [mapRow] = await db
    .select()
    .from(maps)
    .where(and(eq(maps.gameId, eft.id), eq(maps.normalizedName, mapSlug)));
  if (!mapRow) return null;

  const [room] = await db
    .select()
    .from(markedRooms)
    .where(and(eq(markedRooms.gameId, eft.id), eq(markedRooms.mapId, mapRow.id), eq(markedRooms.slug, roomSlug)));
  if (!room) return null;

  // Якорь: синканный lock-маркер по (mapId, linkedItemId == keyItemId).
  let anchor: { x: number; z: number } | null = null;
  if (room.keyItemId) {
    const locks = await db
      .select()
      .from(markers)
      .where(and(eq(markers.source, "sync"), eq(markers.type, "lock"), eq(markers.mapId, room.mapId)));
    const lock = locks.find((l) => l.linkedItemId === room.keyItemId && l.x != null && l.z != null);
    if (lock && lock.x != null && lock.z != null) anchor = { x: lock.x, z: lock.z };
  }

  const [priceMap, catalog] = await Promise.all([getEftPriceMapFromDb(), getEftCatalog()]);
  const priceOf = (tpl: string): number => {
    const p = priceMap.get(tpl);
    return p?.lastLowPrice ?? p?.avg24hPrice ?? 0;
  };
  const catById = new Map(catalog.map((i) => [i.id, i]));

  // Лут комнаты: loose-точки в радиусе вокруг замка → агрегат по предметам.
  const loot: RoomLootItem[] = [];
  let sumEv = 0;
  if (anchor) {
    const spawns = await db
      .select({ x: lootSpawns.x, z: lootSpawns.z, probability: lootSpawns.probability, pool: lootSpawns.pool })
      .from(lootSpawns)
      .where(and(eq(lootSpawns.gameId, eft.id), eq(lootSpawns.mapId, room.mapId)));

    // notAppear = Π(1 − w) по всем точкам → chance = 1 − notAppear; ev = Σ w·price.
    const agg = new Map<string, { notAppear: number; ev: number }>();
    for (const s of spawns) {
      if (s.x == null || s.z == null) continue;
      if (Math.hypot(s.x - anchor.x, s.z - anchor.z) > ROOM_LOOT_RADIUS) continue;
      for (const it of (s.pool ?? []) as LootPoolEntry[]) {
        const w = Math.min(1, (s.probability ?? 0) * it.prob);
        const cur = agg.get(it.tpl) ?? { notAppear: 1, ev: 0 };
        cur.notAppear *= 1 - w;
        cur.ev += w * priceOf(it.tpl);
        agg.set(it.tpl, cur);
      }
    }
    for (const [tpl, v] of agg) {
      const cat = catById.get(tpl);
      sumEv += v.ev;
      loot.push({
        itemId: tpl,
        name: cat?.name ?? tpl,
        shortName: cat?.shortName ?? "",
        backgroundColor: priceMap.get(tpl)?.backgroundColor ?? null,
        chance: 1 - v.notAppear,
        price: priceOf(tpl),
        ev: v.ev,
      });
    }
    loot.sort((a, b) => b.ev - a.ev);
  }
  sumEv = Math.round(sumEv);

  // Ключ + вердикт окупаемости.
  let key: MarkedRoomKey | null = null;
  if (room.keyItemId) {
    const kc = catById.get(room.keyItemId);
    const kp = priceOf(room.keyItemId) || null;
    key = { id: room.keyItemId, name: kc?.name ?? room.title, shortName: kc?.shortName ?? "", price: kp };
  }
  const verdict: MarkedRoomVerdict | null =
    key?.price != null
      ? { keyPrice: key.price, sumEv, net: sumEv - key.price, profitable: sumEv - key.price > 0 }
      : null;

  return {
    room,
    mapSlug,
    mapName: mapRow.name,
    anchor,
    key,
    loot: loot.slice(0, LOOT_TOP_N),
    sumEv,
    verdict,
  };
}
