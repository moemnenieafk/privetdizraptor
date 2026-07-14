// Контентные подразделы «Связи»: Обновления игры, Блог, Мастер-классы.
// Один движок на три вкладки — различает поле kind.
//
// ВАЖНО про патчноуты: полный текст BSG мы НЕ зеркалим (их контент). Из Steam берём
// заголовок, дату, короткую выжимку и ссылку на первоисточник; ценность добавляем
// своим разбором на русском (bodyRu) — BSG публикует патчи по-английски, перевода
// и объяснения «что это значит для игрока» ни у кого нет.
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { games, profiles } from "./schema";

export type ArticleKind = "patch" | "news" | "masterclass";
export type ArticleSource = "cta" | "steam";

export const comlinkArticles = pgTable(
  "comlink_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ArticleKind>().notNull(),
    title: text("title").notNull(),
    /** Человекочитаемый URL. Для патчей генерится из версии. */
    slug: text("slug").notNull(),
    /** Короткая выжимка (для патчей — из Steam, ≤400 симв.). */
    excerpt: text("excerpt").notNull().default(""),
    /** НАШ текст: разбор патча по-русски, статья блога, описание мастер-класса. Markdown. */
    bodyRu: text("body_ru").notNull().default(""),
    coverUrl: text("cover_url"),

    /** Откуда: 'cta' (написали сами) | 'steam' (импорт патчноута). */
    source: text("source").$type<ArticleSource>().notNull().default("cta"),
    /** gid новости в Steam — ключ дедупликации при повторном синке. */
    externalId: text("external_id"),
    /** Ссылка на первоисточник (обязательна для импорта). */
    externalUrl: text("external_url"),

    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    /** Мастер-классы: когда проводится. */
    eventAt: timestamp("event_at", { withTimezone: true }),
    /** Мастер-классы: ссылка на запись (YouTube/Twitch). */
    videoUrl: text("video_url"),

    /** Автор из ЦТА (для импорта — NULL). */
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    /** Черновик не показываем. Импорт публикуется сразу. */
    published: boolean("published").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("comlink_articles_feed_idx").on(t.gameId, t.kind, t.published, t.publishedAt),
    uniqueIndex("comlink_articles_slug_uq").on(t.gameId, t.slug),
    // Дедуп импорта: один gid Steam = одна запись.
    uniqueIndex("comlink_articles_external_uq").on(t.gameId, t.source, t.externalId),
  ],
);

export type ArticleRow = typeof comlinkArticles.$inferSelect;
export type NewArticleRow = typeof comlinkArticles.$inferInsert;
