// Ридер меченых/цветных комнат для страницы /eft/maps/<map>/rooms/<slug>.
// Решение: docs/decisions/marked-rooms.md (Фаза 2). Данные: marked_rooms + markers (якорь-замок) +
// loot_spawns (лут в радиусе вокруг замка — подтверждено пробой; полигон уточнит границы позже) +
// живые цены (prices) + бартеры (реальная цена получения ключа). EV/шанс/цены считаются ЗДЕСЬ.
//
// Импорты относительные (не @/) — модуль читается и из RSC, и под tsx-скриптом (как prices.ts).
import { and, eq, sql, desc, inArray } from "drizzle-orm";
import { db } from "./index";
import { games, maps, lootSpawns, barters, type LootPoolEntry, type TradeSlot } from "./schema";
import { markers } from "./schema-markers";
import { markedRooms, roomOpens, roomOpenItems, reputationEvents, type MarkedRoomRow } from "./schema-marked-rooms";
import { getEftPriceMapFromDb } from "./prices";
import { getEftCatalog, type EftCatalogItem } from "../lib/eft-catalog";
import type { EftPriceInfo } from "../lib/eft-prices";

/** Радиус (в игровых метрах) вокруг замка, из которого берём loose-лут комнаты (черновой срез до полигона). */
export const ROOM_LOOT_RADIUS = 12;
/** Сколько позиций лут-таблицы отдаём (топ по матожиданию). */
const LOOT_TOP_N = 24;

type PriceMap = Map<string, EftPriceInfo>;
const unitPrice = (m: PriceMap, tpl: string): number => {
  const p = m.get(tpl);
  return p?.lastLowPrice ?? p?.avg24hPrice ?? 0;
};

export interface RoomLootItem {
  itemId: string;
  name: string;
  shortName: string;
  backgroundColor: string | null; // цвет фона слота (редкость), из зеркала цен
  chance: number;                 // P(предмет появится ≥1 раз в комнате), 0..1 — базовый (SPT)
  communityChance?: number | null; // динамический шанс по открытиям сообщества (окно 100), 0..1
  price: number;                  // цена за штуку (live)
  ev: number;                     // вклад в матожидание ₽
}

/** Предмет в открытии (лента трекера). */
export interface RoomOpenItemView {
  itemId: string;
  name: string;
  shortName: string;
  qty: number;
  backgroundColor: string | null;
}
/** Одно подтверждённое открытие комнаты. */
export interface RoomOpenView {
  id: string;
  createdAt: Date;
  openedAt: Date | null;
  items: RoomOpenItemView[];
}

/** Дешевейший способ получить ключ. cost=null — ключ только в рейде / цены нет. */
export interface KeyAcquisition {
  method: "flea" | "barter" | null;
  cost: number | null;
  fleaPrice: number | null; // null, если ключ noFlea
  noFlea: boolean;
  barter: { trader: string; cost: number } | null; // дешевейший бартер (₽ за 1 ключ)
}

export interface MarkedRoomKey {
  id: string;
  name: string;
  shortName: string;
  acquisition: KeyAcquisition;
}

export interface MarkedRoomVerdict {
  keyCost: number;
  method: "flea" | "barter";
  sumEv: number;
  net: number;              // sumEv − keyCost (за ОДНО открытие)
  profitable: boolean;      // одно открытие ≥ цены ключа (одноразовая логика)
  breakeven: number | null; // за сколько открытий ключ окупается ⌈keyCost / sumEv⌉ — ключ многоразовый
  keyUses: number | null;       // лимит использований ключа; null — безлимит/неизвестно
  lifetimeProfit: number | null; // профит за срок ключа: keyUses·sumEv − keyCost; null — безлимит
}

export interface MarkedRoomView {
  room: MarkedRoomRow;
  mapSlug: string;
  mapName: string;
  anchor: { x: number; z: number } | null; // позиция замка (центр радиуса)
  key: MarkedRoomKey | null;
  loot: RoomLootItem[];
  sumEv: number;
  verdict: MarkedRoomVerdict | null; // null, если цена получения ключа неизвестна
  opens: RoomOpenView[];             // лента подтверждённых открытий (новые сверху)
  totalOpens: number;                // всего approved-открытий в окне (знаменатель динам. шанса)
}

/** Дешевейшая цена получения ключа: бартер (Σ требуемых) либо flea (если не noFlea). */
async function keyAcquisition(gameId: string, keyId: string, priceMap: PriceMap): Promise<KeyAcquisition> {
  const kp = priceMap.get(keyId);
  const noFlea = kp?.types?.includes("noFlea") ?? false;
  const fleaPrice = noFlea ? null : (kp?.lastLowPrice ?? kp?.avg24hPrice ?? null);

  // Бартеры, где ключ — в награде (jsonb-containment: matched даже с доп. полем count).
  const rows = await db
    .select({ requiredItems: barters.requiredItems, rewardItems: barters.rewardItems, trader: barters.traderNormalizedName })
    .from(barters)
    .where(and(eq(barters.gameId, gameId), sql`${barters.rewardItems} @> ${JSON.stringify([{ itemId: keyId }])}::jsonb`));

  let barter: { trader: string; cost: number } | null = null;
  for (const b of rows) {
    const rew = (b.rewardItems ?? []).find((r: TradeSlot) => r.itemId === keyId);
    const rewCount = rew?.count || 1;
    let cost = 0;
    let ok = true;
    for (const req of b.requiredItems ?? []) {
      const rp = unitPrice(priceMap, req.itemId);
      if (rp <= 0) { ok = false; break; } // требуемый предмет без цены → бартер не оценить надёжно
      cost += rp * req.count;
    }
    if (!ok) continue;
    const per = Math.round(cost / rewCount);
    if (!barter || per < barter.cost) barter = { trader: b.trader ?? "?", cost: per };
  }

  const opts: { method: "flea" | "barter"; cost: number }[] = [];
  if (fleaPrice != null && fleaPrice > 0) opts.push({ method: "flea", cost: fleaPrice });
  if (barter) opts.push({ method: "barter", cost: barter.cost });
  opts.sort((a, b) => a.cost - b.cost);
  const best = opts[0];
  return { method: best?.method ?? null, cost: best?.cost ?? null, fleaPrice, noFlea, barter };
}

/** Окно последних approved-открытий для динамического шанса. */
const OPENS_WINDOW = 100;

/** Лента approved-открытий (последние 100) + динамический шанс предмета (частота появления). */
async function loadRoomOpens(
  roomId: string,
  catById: Map<string, EftCatalogItem>,
  priceMap: PriceMap,
): Promise<{ opens: RoomOpenView[]; total: number; chanceByItem: Map<string, number> }> {
  const openRows = await db
    .select({ id: roomOpens.id, createdAt: roomOpens.createdAt, openedAt: roomOpens.openedAt })
    .from(roomOpens)
    .where(and(eq(roomOpens.roomId, roomId), eq(roomOpens.status, "approved")))
    .orderBy(desc(roomOpens.createdAt))
    .limit(OPENS_WINDOW);
  const total = openRows.length;
  if (total === 0) return { opens: [], total: 0, chanceByItem: new Map() };

  const itemRows = await db
    .select()
    .from(roomOpenItems)
    .where(inArray(roomOpenItems.openId, openRows.map((o) => o.id)));

  const byOpen = new Map<string, RoomOpenItemView[]>();
  const appear = new Map<string, number>(); // item → в скольких открытиях появился
  const seen = new Map<string, Set<string>>(); // openId → set(itemId) для уникальности
  for (const it of itemRows) {
    const cat = catById.get(it.itemId);
    const list = byOpen.get(it.openId) ?? [];
    list.push({ itemId: it.itemId, name: cat?.name ?? it.itemId, shortName: cat?.shortName ?? "", qty: it.qty, backgroundColor: priceMap.get(it.itemId)?.backgroundColor ?? null });
    byOpen.set(it.openId, list);
    let s = seen.get(it.openId);
    if (!s) { s = new Set(); seen.set(it.openId, s); }
    if (!s.has(it.itemId)) { s.add(it.itemId); appear.set(it.itemId, (appear.get(it.itemId) ?? 0) + 1); }
  }
  const chanceByItem = new Map<string, number>();
  for (const [itemId, c] of appear) chanceByItem.set(itemId, c / total);

  const opens: RoomOpenView[] = openRows.map((o) => ({ id: o.id, createdAt: o.createdAt, openedAt: o.openedAt, items: byOpen.get(o.id) ?? [] }));
  return { opens, total, chanceByItem };
}

/** Добавить подтверждённое открытие (модератор/админ). Возвращает id открытия. */
export async function addRoomOpen(roomId: string, itemIds: string[], moderatorId: string): Promise<string> {
  const now = new Date();
  const [open] = await db
    .insert(roomOpens)
    .values({ roomId, status: "approved", moderatorId, moderatedAt: now, openedAt: now })
    .returning({ id: roomOpens.id });
  const uniq = [...new Set(itemIds.filter((s) => typeof s === "string" && s.length > 0))];
  if (uniq.length) await db.insert(roomOpenItems).values(uniq.map((itemId) => ({ openId: open.id, itemId, qty: 1 })));
  return open.id;
}

/** Репутация автору за принятое открытие. */
const REP_PER_OPEN = 10;

/** Открытие на модерации (панель модератора). */
export interface PendingRoomOpen {
  id: string;
  createdAt: Date;
  proofYoutubeUrl: string | null;
  gameVersion: string | null;
  authorId: string | null;
  items: { itemId: string; name: string; shortName: string }[];
}

/** Публичная подача открытия (любой авторизованный) → status='pending'. Возвращает id. */
export async function submitRoomOpen(
  roomId: string,
  itemIds: string[],
  authorId: string,
  opts: { proofYoutubeUrl?: string | null; gameVersion?: string | null; openedAt?: Date | null } = {},
): Promise<string> {
  const [open] = await db
    .insert(roomOpens)
    .values({ roomId, authorId, status: "pending", proofYoutubeUrl: opts.proofYoutubeUrl ?? null, gameVersion: opts.gameVersion ?? null, openedAt: opts.openedAt ?? null })
    .returning({ id: roomOpens.id });
  const uniq = [...new Set(itemIds.filter((s) => typeof s === "string" && s.length > 0))];
  if (uniq.length) await db.insert(roomOpenItems).values(uniq.map((itemId) => ({ openId: open.id, itemId, qty: 1 })));
  return open.id;
}

/** Модерация: approve (→approved + репутация автору) / reject (→rejected). */
export async function moderateRoomOpen(openId: string, action: "approve" | "reject", moderatorId: string): Promise<{ ok: boolean }> {
  const [open] = await db.select({ authorId: roomOpens.authorId }).from(roomOpens).where(eq(roomOpens.id, openId));
  if (!open) return { ok: false };
  await db
    .update(roomOpens)
    .set({ status: action === "approve" ? "approved" : "rejected", moderatorId, moderatedAt: new Date() })
    .where(eq(roomOpens.id, openId));
  if (action === "approve" && open.authorId) {
    await db.insert(reputationEvents).values({ userId: open.authorId, delta: REP_PER_OPEN, reason: "room_open_approved", refType: "room_open", refId: openId });
  }
  return { ok: true };
}

/** Открытия на модерации (pending) для комнаты. */
export async function getPendingRoomOpens(roomId: string): Promise<PendingRoomOpen[]> {
  const rows = await db
    .select({ id: roomOpens.id, createdAt: roomOpens.createdAt, proofYoutubeUrl: roomOpens.proofYoutubeUrl, gameVersion: roomOpens.gameVersion, authorId: roomOpens.authorId })
    .from(roomOpens)
    .where(and(eq(roomOpens.roomId, roomId), eq(roomOpens.status, "pending")))
    .orderBy(desc(roomOpens.createdAt))
    .limit(50);
  if (rows.length === 0) return [];
  const catalog = await getEftCatalog();
  const catById = new Map(catalog.map((i) => [i.id, i]));
  const itemRows = await db.select().from(roomOpenItems).where(inArray(roomOpenItems.openId, rows.map((r) => r.id)));
  const byOpen = new Map<string, { itemId: string; name: string; shortName: string }[]>();
  for (const it of itemRows) {
    const cat = catById.get(it.itemId);
    const l = byOpen.get(it.openId) ?? [];
    l.push({ itemId: it.itemId, name: cat?.name ?? it.itemId, shortName: cat?.shortName ?? "" });
    byOpen.set(it.openId, l);
  }
  return rows.map((r) => ({ ...r, items: byOpen.get(r.id) ?? [] }));
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
        cur.ev += w * unitPrice(priceMap, it.tpl);
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
        price: unitPrice(priceMap, tpl),
        ev: v.ev,
      });
    }
    loot.sort((a, b) => b.ev - a.ev);
  }
  sumEv = Math.round(sumEv);

  // Ключ (реальная цена получения) + вердикт окупаемости.
  let key: MarkedRoomKey | null = null;
  if (room.keyItemId) {
    const kc = catById.get(room.keyItemId);
    key = {
      id: room.keyItemId,
      name: kc?.name ?? room.title,
      shortName: kc?.shortName ?? "",
      acquisition: await keyAcquisition(eft.id, room.keyItemId, priceMap),
    };
  }
  const keyUsesRaw = room.keyItemId ? catById.get(room.keyItemId)?.properties.uses : undefined;
  const keyUses = keyUsesRaw && keyUsesRaw > 0 ? keyUsesRaw : null; // 0/undefined = безлимит
  const verdict: MarkedRoomVerdict | null =
    key?.acquisition.cost != null && key.acquisition.method != null
      ? {
          keyCost: key.acquisition.cost,
          method: key.acquisition.method,
          sumEv,
          net: sumEv - key.acquisition.cost,
          profitable: sumEv - key.acquisition.cost > 0,
          breakeven: sumEv > 0 ? Math.ceil(key.acquisition.cost / sumEv) : null,
          keyUses,
          lifetimeProfit: keyUses != null ? keyUses * sumEv - key.acquisition.cost : null,
        }
      : null;

  // Трекер открытий: лента approved + динамический шанс (окно 100); communityChance мёржим в лут.
  const { opens, total: totalOpens, chanceByItem } = await loadRoomOpens(room.id, catById, priceMap);
  for (const l of loot) l.communityChance = chanceByItem.get(l.itemId) ?? null;

  return {
    room,
    mapSlug,
    mapName: mapRow.name,
    anchor,
    key,
    loot: loot.slice(0, LOOT_TOP_N),
    sumEv,
    verdict,
    opens,
    totalOpens,
  };
}
