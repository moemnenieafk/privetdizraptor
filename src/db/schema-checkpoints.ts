// Чекпоинты прогресса квестов — фикс-слоты (кросс-девайс через аккаунт).
// Живёт отдельно от schema.ts (паттерн schema-comlink): DDL в checkpoints-ddl.ts,
// т.к. db:push с телефона недоступен; Drizzle работает с таблицей из любого модуля.
//
// slot: 0 = автосохранение (страховка перед restore/сбросом), 1..3 = ручные слоты.
// Максимум 4 строки на user+game (unique (user_id, game_id, slot)); сохранение = upsert.
// В отличие от quest_progress (живой стейт) — снимки, к которым игрок возвращается.
import { pgTable, uuid, text, jsonb, timestamp, smallint, index, uniqueIndex } from "drizzle-orm/pg-core";
import { games, profiles } from "./schema";
import type { ProgressPayload } from "@/lib/cta-api";

export const questCheckpoints = pgTable(
  "cta_quest_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    /** 0 = автосохранение, 1..3 = ручные слоты. */
    slot: smallint("slot").notNull(),
    /** Имя слота (ручной — от юзера; авто — «Автосохранение»). */
    name: text("name").notNull(),
    /** Полный снимок прогресса на момент сохранения. */
    payload: jsonb("payload").$type<ProgressPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("cta_quest_checkpoints_slot_uq").on(t.userId, t.gameId, t.slot),
    index("cta_quest_checkpoints_list_idx").on(t.userId, t.gameId, t.createdAt),
  ],
);
