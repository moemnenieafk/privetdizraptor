// Кодекс: чтение и запись (эпик E10, фаза 3).
//
// ФОЛБЭК НА СТАТИКУ. Пока миграция не накатана (таблицы нет) или статья ещё не
// засеяна, читаем из src/data/codex — как раньше. Это не костыль, а требование
// последовательности деплоя: код и миграция выезжают одним пушем, и билд не должен
// падать из-за отсутствующей таблицы (тот же дедлок, что описан в db/articles.ts).
// После сида БД становится источником правды, статика остаётся аварийным дублем.
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { codexArticles } from "@/db/schema-codex";
import { eftGameId } from "@/db/eft";
import { getCodexArticle as getStaticCodexArticle, CODEX_SLUGS, STATIC_CODEX } from "@/data/codex";
import type { CodexArticle } from "@/types/codex";

export interface CodexRecord {
  id: string | null;
  slug: string;
  title: string;
  doc: CodexArticle;
  published: boolean;
  /** true — статья ещё не в БД, отдана из статики (править нельзя, пока не засеяна). */
  fromStatic: boolean;
  updatedAt: string | null;
}

/** Одна статья. includeDrafts=true только для CMS-роли в режиме черновика. */
export async function getCodex(
  slug: string,
  includeDrafts = false,
): Promise<CodexRecord | null> {
  try {
    const gameId = await eftGameId();
    const [row] = await db
      .select()
      .from(codexArticles)
      .where(and(eq(codexArticles.gameId, gameId), eq(codexArticles.slug, slug)))
      .limit(1);

    if (row) {
      if (!row.published && !includeDrafts) return null;
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        doc: row.doc,
        published: row.published,
        fromStatic: false,
        updatedAt: row.updatedAt.toISOString(),
      };
    }
  } catch (e) {
    console.warn("[codex] БД недоступна, фолбэк на статику:", e instanceof Error ? e.message : e);
  }

  const s = getStaticCodexArticle(slug);
  if (!s) return null;
  return {
    id: null,
    slug: s.slug,
    title: s.title,
    doc: s,
    published: true,
    fromStatic: true,
    updatedAt: null,
  };
}

export interface CodexListItem {
  slug: string;
  title: string;
  published: boolean;
  fromStatic: boolean;
}

/** Список статей для CMS-хаба: БД + ещё не засеянная статика. */
export async function listCodex(includeDrafts = false): Promise<CodexListItem[]> {
  const items = new Map<string, CodexListItem>();

  for (const slug of CODEX_SLUGS) {
    items.set(slug, {
      slug,
      title: STATIC_CODEX[slug].title,
      published: true,
      fromStatic: true,
    });
  }

  try {
    const gameId = await eftGameId();
    const rows = await db
      .select({
        slug: codexArticles.slug,
        title: codexArticles.title,
        published: codexArticles.published,
      })
      .from(codexArticles)
      .where(eq(codexArticles.gameId, gameId))
      .orderBy(asc(codexArticles.title));

    for (const r of rows) {
      if (!r.published && !includeDrafts) {
        items.delete(r.slug);
        continue;
      }
      items.set(r.slug, { ...r, fromStatic: false });
    }
  } catch (e) {
    console.warn("[codex] список из статики:", e instanceof Error ? e.message : e);
  }

  return [...items.values()].sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

/** Создание/правка. Возвращает slug — по нему сбрасывается кэш страницы. */
export async function upsertCodex(
  authorId: string,
  doc: CodexArticle,
  published: boolean,
): Promise<void> {
  const gameId = await eftGameId();
  await db
    .insert(codexArticles)
    .values({
      gameId,
      slug: doc.slug,
      title: doc.title,
      doc,
      published,
      authorId,
    })
    .onConflictDoUpdate({
      target: [codexArticles.gameId, codexArticles.slug],
      set: {
        title: doc.title,
        doc,
        published,
        authorId,
        updatedAt: new Date(),
      },
    });
}

export async function deleteCodex(slug: string): Promise<void> {
  const gameId = await eftGameId();
  await db
    .delete(codexArticles)
    .where(and(eq(codexArticles.gameId, gameId), eq(codexArticles.slug, slug)));
}

/** Первичный сид: переносит статьи из src/data/codex в БД. Идемпотентен. */
export async function seedCodexFromStatic(): Promise<{ inserted: number; skipped: number }> {
  const gameId = await eftGameId();
  let inserted = 0;
  let skipped = 0;

  for (const slug of CODEX_SLUGS) {
    const doc = STATIC_CODEX[slug];
    const res = await db
      .insert(codexArticles)
      .values({ gameId, slug, title: doc.title, doc, published: true })
      .onConflictDoNothing({ target: [codexArticles.gameId, codexArticles.slug] })
      .returning({ id: codexArticles.id });

    if (res.length > 0) inserted += 1;
    else skipped += 1;
  }

  return { inserted, skipped };
}
