// Спецификации квестов «Оружейник» — пороги, которые должна пройти сборка.
//
// Живёт отдельно от schema.ts намеренно: тот уже огромный, а таблица самодостаточна.
// На Drizzle это не влияет — db.select()/insert() принимают объект таблицы из любого
// модуля; реляционные запросы (db.query.*) в проекте не используются.
//
// Почему таблица, а не JSON в src/data: наш дамп квестов (eft-quests.json) режет
// TaskObjectiveBuildItem до одного description — ни порогов, ни обязательных деталей.
// Перегенерить его с телефона нельзя (нужен npm), а таблицу наполняет роут синка.
//
// Наполняет /api/cron/sync-weapons (тот же прогон, что и оружейный слой).
import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { games } from "./schema";

/**
 * Числовой порог из квеста. Имена приходят от tarkov.dev как есть
 * (ergonomics / recoil / weight / sightingRange / durability / …),
 * compareMethod — один из >, >=, <, <=, =.
 * Нормализацию делает src/lib/gunsmith.ts, здесь храним сырьё 1:1 с источником.
 */
export type GunsmithThreshold = {
  name: string;
  compareMethod: string;
  value: number;
};

export const gunsmithSpecs = pgTable(
  "gunsmith_specs",
  {
    /** id ЦЕЛИ (TaskObjectiveBuildItem.id), а не квеста: у квеста может быть 2+ сборки
     *  («Старый друг» просит сразу три ствола). */
    objectiveId: text("objective_id").primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    taskName: text("task_name").notNull(),
    traderName: text("trader_name"),
    minPlayerLevel: integer("min_player_level"),
    /** Порядковый номер части («Оружейник. Часть 7» → 7). Для сортировки; null у именных. */
    part: integer("part"),
    /** Ствол, который надо модифицировать. */
    baseItemId: text("base_item_id").notNull(),
    /** Обязательные детали (containsAll) — конкретные предметы. */
    requiredItemIds: jsonb("required_item_ids").$type<string[]>().notNull().default([]),
    /** Обязательные КАТЕГОРИИ (containsCategory) — «любой глушитель», «любой коллиматор». */
    requiredCategoryIds: jsonb("required_category_ids").$type<string[]>().notNull().default([]),
    /** Пороги: эрго ≥ 45, отдача ≤ 850, вес ≤ 3.5 … */
    thresholds: jsonb("thresholds").$type<GunsmithThreshold[]>().notNull().default([]),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("gunsmith_specs_task_idx").on(t.gameId, t.taskId)],
);

export type GunsmithSpecRow = typeof gunsmithSpecs.$inferSelect;
export type NewGunsmithSpecRow = typeof gunsmithSpecs.$inferInsert;