// Медиа-библиотека (эпик E10, фаза 4). Файлы лежат в публичном бакете Supabase
// Storage `cta-media` под префиксом content/, а эта таблица — их каталог: без неё
// нельзя показать редактору, что вообще залито (Storage API листает медленно и
// не хранит ни автора, ни alt-текст).
import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { profiles } from "./schema";

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Ключ объекта в бакете cta-media, напр. content/2026/ab12….webp */
    path: text("path").notNull(),
    /** Публичный URL (кэшируем, чтобы не собирать на каждом рендере). */
    url: text("url").notNull(),

    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),

    /** Подпись/alt — доступность и подсказка редактору, что это за файл. */
    alt: text("alt").notNull().default(""),

    uploadedBy: uuid("uploaded_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("media_assets_recent_idx").on(t.createdAt)],
);

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
