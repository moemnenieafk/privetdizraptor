// Drizzle-дефиниция editorial_markers для ЗАПРОСОВ (миграцию ведёт editorial-markers-ddl.ts,
// накат db:migrate-all — как schema-codex/schema-media). Не в schema.ts → db:push её не трогает.
//
// МОДЕЛЬ: скаляры, по которым фильтруем/рендерим (map_id, link_*), — колонками; медиа —
// массивом ключей Storage в jsonb. Ручной маркер карты: координаты + скрины + описание +
// опц. привязка к квесту/истории. Решения: docs/decisions/editorial-markers-tool.md.
import { pgTable, uuid, text, integer, real, jsonb, timestamp, index, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { games, maps, profiles } from "./schema";

export type EditorialLinkKind = "story" | "quest" | "event" | "none" | "item";

export const editorialMarkers = pgTable(
  "editorial_markers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    /** Этаж мультиэтажной карты; null — базовый. */
    floor: integer("floor"),
    x: real("x").notNull(),
    y: real("y"),
    z: real("z").notNull(),
    /** Вид маркера (иконка) — reuse категорий manual-marker-icon. */
    type: text("type").notNull().default("poi"),
    category: text("category"),
    /** Фракция выхода/спавна (all|pmc|scav) — для резолва иконки, как у ручных маркеров. */
    faction: text("faction"),
    title: text("title").notNull(),
    description: text("description"),
    /** Массив media-ключей Supabase Storage (скриншоты). */
    screenshots: jsonb("screenshots").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** Привязка: 'story' (story slug) | 'quest' (BSG id) | 'event' (игровое событие) | 'none'. */
    linkKind: text("link_kind").$type<EditorialLinkKind>().notNull().default("none"),
    linkId: text("link_id"),
    /** Опц. шаг сюжетной истории. */
    linkStep: integer("link_step"),
    /** Полигон-область (лассо): массив игровых точек {x,z}; null — обычная точка-маркер. */
    polygon: jsonb("polygon").$type<{ x: number; z: number }[]>(),
    /** Оверрайд синканного маркера tarkov.dev (его id); null — самостоятельный editorial-маркер. */
    sourceMarkerId: text("source_marker_id"),
    /** Скрыть синканный маркер (кривой/устаревший) — оверрайд подавляет его на рендере. */
    hidden: boolean("hidden").notNull().default(false),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("editorial_markers_map_idx").on(t.gameId, t.mapId),
    index("editorial_markers_link_idx").on(t.linkKind, t.linkId),
  ],
);

export type EditorialMarkerRow = typeof editorialMarkers.$inferSelect;
export type NewEditorialMarker = typeof editorialMarkers.$inferInsert;
