// Профиль игрока — серверная точка истины (кросс-девайс через аккаунт).
// Живёт отдельным модулем (паттерн schema-checkpoints/comlink): DDL в player-profile-ddl.ts,
// т.к. db:push требует TTY. Один профиль на user+game (unique (user_id, game_id)); сохранение = upsert.
// Спека: docs/decisions/player-profile-persistence.md.
import { pgTable, uuid, jsonb, integer, bigint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { games, profiles } from "./schema";
import type { PlayerProfileSnapshot } from "@/types/eft-player";

export const playerProfiles = pgTable(
  "cta_player_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    /** Полный снимок: рич-вью + идентичность + ручные оверрайды (форма PlayerProfileSnapshot). */
    snapshot: jsonb("snapshot").$type<PlayerProfileSnapshot>().notNull(),
    /** Денорм-индексы для сортировок/лидербордов без разбора JSONB. */
    level: integer("level"),
    experience: bigint("experience", { mode: "number" }),
    /** Откуда данные: 'tarkov.dev' | 'game-profile' | 'manual' | 'mixed'. */
    source: text("source"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("cta_player_profiles_user_game_uq").on(t.userId, t.gameId)],
);
