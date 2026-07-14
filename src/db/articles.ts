// Контентные подразделы: чтение лент + синк патчноутов из Steam. Только для сервера.
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import {
  comlinkArticles,
  type ArticleKind,
  type ArticleRow,
} from "@/db/schema-articles";
import { getSteamPatchNotes, patchSlug } from "@/lib/steam-news";
import { eftGameId } from "@/db/eft";

/* ─────────────────── синк патчноутов ─────────────────── */

export interface SyncPatchesResult {
  fetched: number;
  inserted: number;
}

/**
 * Импорт патчноутов из Steam. ВСТАВКА ТОЛЬКО НОВЫХ: onConflictDoNothing по
 * (gameId, source, externalId) — если Дима уже написал русский разбор к патчу,
 * повторный синк его не затрёт.
 */
export async function syncSteamPatches(): Promise<SyncPatchesResult> {
  const news = await getSteamPatchNotes(20);
  const gameId = await eftGameId();

  let inserted = 0;

  for (const n of news) {
    const rows = await db
      .insert(comlinkArticles)
      .values({
        gameId,
        kind: "patch",
        title: n.title,
        slug: patchSlug(n.title, n.gid),
        excerpt: n.excerpt,
        source: "steam",
        externalId: n.gid,
        externalUrl: n.url,
        publishedAt: n.publishedAt,
        published: true,
      })
      .onConflictDoNothing()
      .returning({ id: comlinkArticles.id });

    inserted += rows.length;
  }

  return { fetched: news.length, inserted };
}

/* ─────────────────── чтение ─────────────────── */

export interface ArticleListItem {
  id: string;
  kind: ArticleKind;
  title: string;
  slug: string;
  excerpt: string;
  /** Есть ли наш русский разбор — на карточке это главный маркер ценности. */
  hasBodyRu: boolean;
  coverUrl: string | null;
  source: string;
  externalUrl: string | null;
  publishedAt: string;
  eventAt: string | null;
  videoUrl: string | null;
  authorName: string | null;
  /** false = черновик. В обычном режиме такие материалы не отдаются вовсе. */
  published: boolean;
}

const toListItem = (r: ArticleRow, authorName: string | null): ArticleListItem => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  slug: r.slug,
  excerpt: r.excerpt,
  hasBodyRu: r.bodyRu.trim().length > 0,
  coverUrl: r.coverUrl,
  source: r.source,
  externalUrl: r.externalUrl,
  publishedAt: r.publishedAt.toISOString(),
  eventAt: r.eventAt ? r.eventAt.toISOString() : null,
  videoUrl: r.videoUrl,
  authorName,
  published: r.published,
});

/**
 * Лента одного вида: патчи / блог / мастер-классы.
 *
 * НЕ БРОСАЕТ. Страницы лент рендерятся статически на билде, а таблица comlink_articles
 * создаётся миграцией, которая живёт в ТОМ ЖЕ деплое — на первой сборке её ещё нет.
 * Без этого перехвата билд падает, деплой не выезжает, миграцию накатить нечем: дедлок.
 * Нет таблицы → пустая лента, страница живёт.
 */
export async function getArticles(
  kind: ArticleKind,
  limit = 30,
  /** true (режим черновика) — отдаём и неопубликованное. Ставится только для CMS-ролей. */
  includeDrafts = false,
): Promise<ArticleListItem[]> {
  try {
    return await getArticlesUnsafe(kind, limit, includeDrafts);
  } catch (e) {
    console.warn("[articles] лента недоступна:", e instanceof Error ? e.message : e);
    return [];
  }
}

async function getArticlesUnsafe(
  kind: ArticleKind,
  limit: number,
  includeDrafts: boolean,
): Promise<ArticleListItem[]> {
  const gameId = await eftGameId();

  const rows = await db
    .select({ a: comlinkArticles, authorName: profiles.username })
    .from(comlinkArticles)
    .leftJoin(profiles, eq(profiles.id, comlinkArticles.authorId))
    .where(
      and(
        eq(comlinkArticles.gameId, gameId),
        eq(comlinkArticles.kind, kind),
        ...(includeDrafts ? [] : [eq(comlinkArticles.published, true)]),
      ),
    )
    // Мастер-классы сортируем по дате события (ближайшие сверху), остальное — по публикации.
    .orderBy(
      kind === "masterclass"
        ? desc(sql`coalesce(${comlinkArticles.eventAt}, ${comlinkArticles.publishedAt})`)
        : desc(comlinkArticles.publishedAt),
    )
    .limit(Math.min(limit, 50));

  return rows.map((r) => toListItem(r.a, r.authorName));
}

export interface ArticleDetail extends ArticleListItem {
  bodyRu: string;
}

/** Один материал. Тоже не бросает — см. коммент к getArticles. */
export async function getArticle(
  slug: string,
  includeDrafts = false,
): Promise<ArticleDetail | null> {
  try {
    return await getArticleUnsafe(slug, includeDrafts);
  } catch (e) {
    console.warn("[articles] материал недоступен:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function getArticleUnsafe(
  slug: string,
  includeDrafts: boolean,
): Promise<ArticleDetail | null> {
  const gameId = await eftGameId();

  const [row] = await db
    .select({ a: comlinkArticles, authorName: profiles.username })
    .from(comlinkArticles)
    .leftJoin(profiles, eq(profiles.id, comlinkArticles.authorId))
    .where(and(eq(comlinkArticles.gameId, gameId), eq(comlinkArticles.slug, slug)))
    .limit(1);

  if (!row) return null;
  if (!row.a.published && !includeDrafts) return null;

  return { ...toListItem(row.a, row.authorName), bodyRu: row.a.bodyRu };
}

/* ─────────────────── CMS (admin | editor) ─────────────────── */

/** Полный материал по id — для формы редактора (тело, статус, источник). */
export async function getArticleForEdit(
  id: string,
): Promise<(ArticleDetail & { imported: boolean }) | null> {
  const [row] = await db
    .select({ a: comlinkArticles, authorName: profiles.username })
    .from(comlinkArticles)
    .leftJoin(profiles, eq(profiles.id, comlinkArticles.authorId))
    .where(eq(comlinkArticles.id, id))
    .limit(1);

  if (!row) return null;
  return {
    ...toListItem(row.a, row.authorName),
    bodyRu: row.a.bodyRu,
    imported: row.a.source === "steam",
  };
}

export interface UpsertArticleInput {
  id?: string;
  kind: ArticleKind;
  title: string;
  slug: string;
  excerpt: string;
  bodyRu: string;
  coverUrl: string | null;
  eventAt: Date | null;
  videoUrl: string | null;
  published: boolean;
}

export async function upsertArticle(
  authorId: string,
  input: UpsertArticleInput,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const gameId = await eftGameId();

  if (input.id) {
    // Правка: bodyRu патча пишем поверх, но title/excerpt импортированного не трогаем —
    // они принадлежат первоисточнику.
    const [existing] = await db
      .select({ source: comlinkArticles.source })
      .from(comlinkArticles)
      .where(eq(comlinkArticles.id, input.id))
      .limit(1);

    if (!existing) return { ok: false, error: "Материал не найден" };

    const patchImported = existing.source === "steam";

    await db
      .update(comlinkArticles)
      .set({
        ...(patchImported
          ? { bodyRu: input.bodyRu }
          : {
              title: input.title,
              slug: input.slug,
              excerpt: input.excerpt,
              bodyRu: input.bodyRu,
              coverUrl: input.coverUrl,
              eventAt: input.eventAt,
              videoUrl: input.videoUrl,
              published: input.published,
            }),
        updatedAt: sql`now()`,
      })
      .where(eq(comlinkArticles.id, input.id));

    return { ok: true, id: input.id };
  }

  const [row] = await db
    .insert(comlinkArticles)
    .values({
      gameId,
      kind: input.kind,
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      bodyRu: input.bodyRu,
      coverUrl: input.coverUrl,
      source: "cta",
      publishedAt: new Date(),
      eventAt: input.eventAt,
      videoUrl: input.videoUrl,
      authorId,
      published: input.published,
    })
    .returning({ id: comlinkArticles.id });

  return { ok: true, id: row.id };
}

export async function deleteArticle(id: string): Promise<void> {
  await db.delete(comlinkArticles).where(eq(comlinkArticles.id, id));
}
