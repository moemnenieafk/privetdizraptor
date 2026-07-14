// Сюжетные гайды: чтение и запись (E10, фаза 5).
//
// ФОЛБЭК НА СТАТИКУ — та же причина, что в db/codex.ts: код и миграция выезжают одним
// деплоем, билд не должен падать из-за ещё не созданной таблицы. После сида источник
// правды — БД, статика остаётся аварийным дублем.
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { storyGuides } from "@/db/schema-story";
import { eftGameId } from "@/db/eft";
import { STORY_WALKTHROUGHS } from "@/data/story-walkthroughs";
import type { StoryWalkthrough } from "@/data/story-walkthroughs/types";

export interface StoryRecord {
  slug: string;
  doc: StoryWalkthrough;
  published: boolean;
  /** Гайд ещё не в БД (отдан из кода) — первое сохранение перенесёт его в базу. */
  fromStatic: boolean;
}

export async function getStory(slug: string, includeDrafts = false): Promise<StoryRecord | null> {
  try {
    const gameId = await eftGameId();
    const [row] = await db
      .select()
      .from(storyGuides)
      .where(and(eq(storyGuides.gameId, gameId), eq(storyGuides.slug, slug)))
      .limit(1);

    if (row) {
      if (!row.published && !includeDrafts) return null;
      return { slug: row.slug, doc: row.doc, published: row.published, fromStatic: false };
    }
  } catch (e) {
    console.warn("[stories] БД недоступна, фолбэк на статику:", e instanceof Error ? e.message : e);
  }

  const s = STORY_WALKTHROUGHS[slug];
  if (!s) return null;
  return { slug, doc: s, published: true, fromStatic: true };
}

export async function upsertStory(
  authorId: string,
  doc: StoryWalkthrough,
  published: boolean,
): Promise<void> {
  const gameId = await eftGameId();
  await db
    .insert(storyGuides)
    .values({ gameId, slug: doc.slug, title: doc.title, doc, published, authorId })
    .onConflictDoUpdate({
      target: [storyGuides.gameId, storyGuides.slug],
      set: { title: doc.title, doc, published, authorId, updatedAt: new Date() },
    });
}

/** Первичный сид: 10 историй из кода в БД. Идемпотентен — правки редактора не затирает. */
export async function seedStoriesFromStatic(): Promise<{ inserted: number; skipped: number }> {
  const gameId = await eftGameId();
  let inserted = 0;
  let skipped = 0;

  for (const [slug, doc] of Object.entries(STORY_WALKTHROUGHS)) {
    const res = await db
      .insert(storyGuides)
      .values({ gameId, slug, title: doc.title, doc, published: true })
      .onConflictDoNothing({ target: [storyGuides.gameId, storyGuides.slug] })
      .returning({ id: storyGuides.id });

    if (res.length > 0) inserted += 1;
    else skipped += 1;
  }

  return { inserted, skipped };
}
