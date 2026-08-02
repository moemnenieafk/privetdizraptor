// Drizzle query-дефиниция единой таблицы `markers` (Фаза 1 — docs/decisions/unified-markers.md).
// ⚠️ ПРЕДЛОЖЕНИЕ: миграцию ведёт markers-ddl.ts (накат db:migrate-all), НЕ schema.ts → db:push её
//    не трогает (как schema-editorial.ts). Здесь — типизированный доступ для будущих ридеров/райтеров
//    (Фазы 2–4). Форма 1:1 с MARKERS_DDL. Ничего пока не импортирует эту таблицу → рантайм не задет.
import { pgTable, uuid, text, integer, real, jsonb, timestamp, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { games, maps, profiles, type MapPos } from "./schema";
import type { EditorialLinkKind } from "./schema-editorial";

/** Источник маркера: зеркало tarkov.dev (крон) или пользовательский (Wizard/CMS). */
export type MarkerSource = "sync" | "user";

export const markers = pgTable(
  "markers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    /** 'sync' — пишет/прюнит только крон; 'user' — Wizard/CMS. */
    source: text("source").$type<MarkerSource>().notNull(),
    /** tarkov.dev id (source='sync'); null у user. Апсерт крона — по (map_id, external_id). */
    externalId: text("external_id"),
    /** Смешанный вокабуляр: sync — MapMarkerKind (loot_container…), user — editorial (loot/container…).
     *  Ридер ветвится по source (мерж-рендерер), потому колонка — свободный text. */
    type: text("type").notNull(),
    floor: integer("floor"),
    /** Координаты игрового мира. Nullable: боссы (спавн по зоне) и чисто-полигональные зоны. */
    x: real("x"),
    y: real("y"),
    z: real("z"),
    /** Диапазон игровой высоты — фильтр этажа (sync). */
    top: real("top"),
    bottom: real("bottom"),
    /** Точки зоны (outline map_markers + лассо editorial). */
    polygon: jsonb("polygon").$type<MapPos[] | { x: number; z: number }[]>(),
    label: text("label"),
    faction: text("faction"),
    sides: jsonb("sides").$type<string[]>(),
    categories: jsonb("categories").$type<string[]>(),
    linkedItemId: text("linked_item_id"),
    linkedQuestId: text("linked_quest_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    /* ── user-надстройка (editorial) ── */
    category: text("category"),
    title: text("title"),
    description: text("description"),
    screenshots: jsonb("screenshots").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    linkKind: text("link_kind").$type<EditorialLinkKind>().notNull().default("none"),
    linkId: text("link_id"),
    linkStep: integer("link_step"),
    /** Оверрайд synced → external_id базовой строки (подавляет/дополняет её на рендере). */
    sourceMarkerId: text("source_marker_id"),
    hidden: boolean("hidden").notNull().default(false),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("markers_map_source_idx").on(t.mapId, t.source),
    index("markers_map_type_idx").on(t.gameId, t.mapId, t.type),
    index("markers_source_marker_idx").on(t.sourceMarkerId),
    index("markers_link_idx").on(t.linkKind, t.linkId),
    uniqueIndex("markers_sync_external_uidx").on(t.mapId, t.externalId).where(sql`source = 'sync'`),
  ],
);

export type MarkerRow = typeof markers.$inferSelect;
export type NewMarker = typeof markers.$inferInsert;
