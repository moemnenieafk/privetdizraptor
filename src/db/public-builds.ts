// Публичные сборки оружия: запись/чтение weapon_builds (isPublic). Только для сервера.
// Билды живут в localStorage (useBuildStore); «Опубликовать» кладёт снимок в БД с
// коротким slug — по нему открывается вьюер /eft/progress/loadouts/b/{slug} и они
// показываются на публичном профиле /u/[username]. Снимок статов считает сервер
// (POST-роут), тут — только персист и выборки.
import { and, desc, eq, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import {
  weaponBuilds,
  type BuildStatsSnapshot,
  type BuildTreeNode,
} from "@/db/schema";
import { eftGameId } from "@/db/eft";

// Короткий slug для ссылки: без похожих символов, url-safe.
const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function genBuildSlug(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  return s;
}

/** Потолок публичных сборок на пользователя (антиспам витрины профиля). */
export const MAX_PUBLIC_BUILDS = 24;

export interface PublicBuildInput {
  name: string;
  purpose: string;
  baseItemId: string;
  tree: BuildTreeNode;
  stats: BuildStatsSnapshot;
}

export async function countUserPublicBuilds(userId: string): Promise<number> {
  const gameId = await eftGameId();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(weaponBuilds)
    .where(
      and(
        eq(weaponBuilds.userId, userId),
        eq(weaponBuilds.gameId, gameId),
        eq(weaponBuilds.isPublic, true),
      ),
    );
  return row?.n ?? 0;
}

/** Публикация сборки. Slug с ретраями на коллизию уникального индекса. */
export async function insertPublicBuild(
  userId: string,
  input: PublicBuildInput,
): Promise<{ ok: boolean; error?: string; slug?: string }> {
  const gameId = await eftGameId();

  if ((await countUserPublicBuilds(userId)) >= MAX_PUBLIC_BUILDS) {
    return { ok: false, error: `Лимит публичных сборок: ${MAX_PUBLIC_BUILDS}. Снимите лишние.` };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = genBuildSlug();
    try {
      await db.insert(weaponBuilds).values({
        userId,
        gameId,
        name: input.name,
        purpose: input.purpose,
        baseItemId: input.baseItemId,
        tree: input.tree,
        stats: input.stats,
        isPublic: true,
        slug,
      });
      return { ok: true, slug };
    } catch (e) {
      // 23505 = unique_violation по slug → следующая попытка; прочее пробрасываем.
      if ((e as { cause?: { code?: string } }).cause?.code === "23505") continue;
      throw e;
    }
  }
  return { ok: false, error: "Не удалось выделить ссылку, попробуйте ещё раз" };
}

/** Снятие с публикации (owner-scoped по slug). */
export async function deletePublicBuild(userId: string, slug: string): Promise<void> {
  await db
    .delete(weaponBuilds)
    .where(and(eq(weaponBuilds.userId, userId), eq(weaponBuilds.slug, slug)));
}

export interface PublicBuildView {
  slug: string;
  name: string;
  purpose: string;
  baseItemId: string;
  stats: BuildStatsSnapshot;
  likes: number;
  createdAt: string;
}

/** Публичные сборки пользователя — для витрины на /u/[username]. Устойчиво к
 *  отсутствию таблицы (профиль не должен падать) → []. */
export async function getUserPublicBuilds(userId: string): Promise<PublicBuildView[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db
      .select()
      .from(weaponBuilds)
      .where(
        and(
          eq(weaponBuilds.userId, userId),
          eq(weaponBuilds.gameId, gameId),
          eq(weaponBuilds.isPublic, true),
        ),
      )
      .orderBy(desc(weaponBuilds.createdAt))
      .limit(MAX_PUBLIC_BUILDS);

    return rows
      .filter((r): r is typeof r & { slug: string } => typeof r.slug === "string")
      .map((r) => ({
        slug: r.slug,
        name: r.name,
        purpose: r.purpose,
        baseItemId: r.baseItemId,
        stats: r.stats,
        likes: r.likes,
        createdAt: r.createdAt.toISOString(),
      }));
  } catch {
    return [];
  }
}

export interface PublicBuildFull {
  slug: string;
  name: string;
  purpose: string;
  baseItemId: string;
  tree: BuildTreeNode;
}

/** Полная сборка по slug (для вьюера /b/{slug}). null — нет / снята / таблицы нет. */
export async function getPublicBuildBySlug(slug: string): Promise<PublicBuildFull | null> {
  try {
    const [r] = await db
      .select()
      .from(weaponBuilds)
      .where(and(eq(weaponBuilds.slug, slug), eq(weaponBuilds.isPublic, true)))
      .limit(1);
    if (!r || !r.slug) return null;
    return { slug: r.slug, name: r.name, purpose: r.purpose, baseItemId: r.baseItemId, tree: r.tree };
  } catch {
    return null;
  }
}
