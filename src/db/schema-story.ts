// Сюжетные гайды в БД (эпик E10, фаза 5). До этого 10 историй жили в
// src/data/story-walkthroughs/*.ts — публикация означала коммит.
//
// МОДЕЛЬ та же, что у Кодекса: скаляры (slug/title/published) — колонками, само
// дерево гайда (шаги → под-этапы → ветки, медиа на каждом узле) — одним jsonb типа
// StoryWalkthrough. Раскладывать дерево по таблицам ради формы редактора бессмысленно:
// оно всегда читается и пишется целиком, а тип остаётся общим для БД, рендера и CMS.
import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { StoryWalkthrough } from "@/data/story-walkthroughs/types";
import { games, profiles } from "./schema";

export const storyGuides = pgTable(
  "story_guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),

    /** URL гайда: /eft/quests/{slug}. */
    slug: text("slug").notNull(),
    title: text("title").notNull(),

    /** Полное дерево гайда. */
    doc: jsonb("doc").$type<StoryWalkthrough>().notNull(),

    published: boolean("published").notNull().default(true),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("story_guides_slug_uq").on(t.gameId, t.slug),
    index("story_guides_list_idx").on(t.gameId, t.published),
  ],
);

export type StoryGuideRow = typeof storyGuides.$inferSelect;
