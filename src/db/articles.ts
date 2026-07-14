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
});

/** Лента одного вида: патчи / блог / мастер-классы. */
export async function getArticles(kind: ArticleKind, limit = 30): Promise<ArticleListItem[]> {
  const gameId = await eftGameId();

  const rows = await db
    .select({ a: comlinkArticles, authorName: profiles.username })
    .from(comlinkArticles)
    .leftJoin(profiles, eq(profiles.id, comlinkArticles.authorId))
    .where(
      and(
        eq(comlinkArticles.gameId, gameId),
        eq(comlinkArticles.kind, kind),
        eq(comlinkArticles.published, true),
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

export async function getArticle(slug: string): Promise<ArticleDetail | null> {
  const gameId = await eftGameId();

  const [row] = await db
    .select({ a: comlinkArticles, authorName: profiles.username })
    .from(comlinkArticles)
    .leftJoin(profiles, eq(profiles.id, comlinkArticles.authorId))
    .where(and(eq(comlinkArticles.gameId, gameId), eq(comlinkArticles.slug, slug)))
    .limit(1);

  if (!row || !row.a.published) return null;

  return { ...toListItem(row.a, row.authorName), bodyRu: row.a.bodyRu };
}

/* ─────────────────── CMS (role=admin) ─────────────────── */

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
