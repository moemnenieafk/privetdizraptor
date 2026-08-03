// Drizzle query-дефиниции таблиц меченых комнат (docs/decisions/done/marked-rooms.md, Фаза 1).
// ⚠️ Миграцию ведёт marked-rooms-ddl.ts (db:migrate-all), НЕ schema.ts → db:push эти таблицы не
//    трогает (как schema-markers.ts / schema-editorial.ts). Здесь — типизированный доступ для
//    будущих ридеров/райтеров. Форма 1:1 с MARKED_ROOMS_DDL.
import {
  pgTable, uuid, text, integer, jsonb, timestamp, boolean, index, uniqueIndex, primaryKey,
} from "drizzle-orm/pg-core";
import { games, maps, profiles } from "./schema";

/** Тип комнаты: меченая (маркированный ключ) или цветная комната Лаборатории. */
export type MarkedRoomKind = "marked" | "lab_color";
/** Статус заявки-открытия в модерации. */
export type RoomOpenStatus = "pending" | "approved" | "rejected";

/** Реестр меченых/цветных комнат: сущность страницы + границы подсветки на карте. */
export const markedRooms = pgTable(
  "marked_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    mapId: text("map_id").notNull().references(() => maps.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    kind: text("kind").$type<MarkedRoomKind>().notNull(),
    color: text("color"),
    keyItemId: text("key_item_id"),
    polygon: jsonb("polygon").$type<{ x: number; z: number }[]>(),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("marked_rooms_slug_uidx").on(t.gameId, t.mapId, t.slug),
    index("marked_rooms_map_idx").on(t.mapId),
  ],
);

/** Одно открытие комнаты — заявка сообщества (в статистику только approved). */
export const roomOpens = pgTable(
  "room_opens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id").notNull().references(() => markedRooms.id, { onDelete: "cascade" }),
    /** null у совсем анонимной заявки; при is_anonymous держим для модерации, но прячем на странице. */
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    status: text("status").$type<RoomOpenStatus>().notNull().default("pending"),
    moderatorId: uuid("moderator_id").references(() => profiles.id, { onDelete: "set null" }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    proofYoutubeUrl: text("proof_youtube_url"),
    /** Ключ временного Storage-бакета; → null после авто-удаления скрина после модерации. */
    proofScreenshotKey: text("proof_screenshot_key"),
    gameVersion: text("game_version"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("room_opens_room_status_idx").on(t.roomId, t.status, t.createdAt)],
);

/** Предметы открытия (M:N) — для ленты и пересчёта шанса по последним 100 approved. */
export const roomOpenItems = pgTable(
  "room_open_items",
  {
    openId: uuid("open_id").notNull().references(() => roomOpens.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    qty: integer("qty").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.openId, t.itemId] })],
);

/** Леджер репутации (delta+reason). Баланс = sum(delta). Обмен на Premium — через энтайтлменты. */
export const reputationEvents = pgTable(
  "reputation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("reputation_events_user_idx").on(t.userId)],
);

export type MarkedRoomRow = typeof markedRooms.$inferSelect;
export type NewMarkedRoom = typeof markedRooms.$inferInsert;
export type RoomOpenRow = typeof roomOpens.$inferSelect;
export type NewRoomOpen = typeof roomOpens.$inferInsert;
export type RoomOpenItemRow = typeof roomOpenItems.$inferSelect;
export type NewRoomOpenItem = typeof roomOpenItems.$inferInsert;
export type ReputationEventRow = typeof reputationEvents.$inferSelect;
export type NewReputationEvent = typeof reputationEvents.$inferInsert;
