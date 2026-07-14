// Кодекс в БД (эпик E10, фаза 3). До этого 8 лор-статей жили в src/data/codex/*.ts,
// и публикация означала коммит — редактор так работать не может.
//
// МОДЕЛЬ: скаляры, по которым ищем и сортируем (slug/title/published), — колонками;
// сама статья (секции, таймлайн, связи, источники) — одним `doc` jsonb типа CodexArticle.
// Причина: структура статьи — наш продуктовый тип, он ещё будет меняться; раскладывать
// его по таблицам значит платить миграцией за каждое поле. Тип один и тот же на чтении,
// на рендере и в редакторе.
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
import type { CodexArticle } from "@/types/codex";
import { games, profiles } from "./schema";

export const codexArticles = pgTable(
  "codex_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),

    /** URL статьи: /eft/gamesetting/{slug}. */
    slug: text("slug").notNull(),
    title: text("title").notNull(),

    /** Полное тело статьи (CodexArticle). Единый источник для рендера и редактора. */
    doc: jsonb("doc").$type<CodexArticle>().notNull(),

    /** Черновик не виден публике (только в режиме черновика у CMS-роли). */
    published: boolean("published").notNull().default(true),

    /** Кто последний правил. NULL — статья пришла из первичного сида. */
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("codex_articles_slug_uq").on(t.gameId, t.slug),
    index("codex_articles_list_idx").on(t.gameId, t.published, t.title),
  ],
);

export type CodexArticleRow = typeof codexArticles.$inferSelect;
