// Публичные сборки оружия: запись/чтение weapon_builds (isPublic). Только для сервера.
// Билды живут в localStorage (useBuildStore); «Опубликовать» кладёт снимок в БД с
// коротким slug — по нему открывается вьюер /eft/progress/loadouts/b/{slug} и они
// показываются на публичном профиле /u/[username]. Снимок статов считает сервер
// (POST-роут), тут — только персист и выборки.
import { and, desc, eq, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import {
  profiles,
  weaponBuilds,
  weaponBuildLikes,
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

/* ───────────────── community-лента (витрина всех публичных сборок) ───────────────── */

export type CommunitySort = "new" | "popular";

export interface CommunityBuild {
  slug: string;
  name: string;
  purpose: string;
  baseItemId: string;
  stats: BuildStatsSnapshot;
  likes: number;
  createdAt: string;
  authorName: string;
  /** Подтверждённый стример — бейдж в карточке. */
  authorStreamer: boolean;
  /** Лайкнул ли текущий зритель (false для анонимов). */
  likedByMe: boolean;
}

export interface CommunityQuery {
  sort: CommunitySort;
  baseItemId?: string | null;
  offset?: number;
  limit?: number;
  /** id зрителя для флага likedByMe. null — аноним. */
  viewerId?: string | null;
}

export interface CommunityPage {
  items: CommunityBuild[];
  /** offset следующей страницы или null, если это последняя. */
  nextOffset: number | null;
}

const COMMUNITY_PAGE = 24;

function clampLimit(n: number | undefined): number {
  if (!Number.isFinite(n) || n === undefined) return COMMUNITY_PAGE;
  return Math.min(Math.max(Math.trunc(n), 1), 48);
}

/**
 * Глобальная лента публичных сборок с автором и флагом лайка зрителя.
 * Сорт: new (createdAt) / popular (likes → createdAt). Фильтр по базе (baseItemId).
 * Offset-пагинация: датасет на старте маленький, keyset избыточен.
 * Устойчива к отсутствию таблицы (до миграции) → пустая страница.
 */
export async function getCommunityBuilds(query: CommunityQuery): Promise<CommunityPage> {
  try {
    const gameId = await eftGameId();
    const limit = clampLimit(query.limit);
    const offset = Math.max(0, Math.trunc(query.offset ?? 0));
    const viewerId = query.viewerId ?? null;

    const conds = [eq(weaponBuilds.gameId, gameId), eq(weaponBuilds.isPublic, true)];
    if (query.baseItemId) conds.push(eq(weaponBuilds.baseItemId, query.baseItemId));

    const orderBy =
      query.sort === "popular"
        ? [desc(weaponBuilds.likes), desc(weaponBuilds.createdAt)]
        : [desc(weaponBuilds.createdAt)];

    // leftJoin лайков по зрителю: при анониме условие всегда ложно → likedUserId = null.
    const likeCond = viewerId
      ? and(eq(weaponBuildLikes.buildId, weaponBuilds.id), eq(weaponBuildLikes.userId, viewerId))
      : sql`false`;

    const rows = await db
      .select({
        slug: weaponBuilds.slug,
        name: weaponBuilds.name,
        purpose: weaponBuilds.purpose,
        baseItemId: weaponBuilds.baseItemId,
        stats: weaponBuilds.stats,
        likes: weaponBuilds.likes,
        createdAt: weaponBuilds.createdAt,
        authorName: profiles.username,
        authorStreamer: profiles.streamer,
        likedUserId: weaponBuildLikes.userId,
      })
      .from(weaponBuilds)
      .innerJoin(profiles, eq(profiles.id, weaponBuilds.userId))
      .leftJoin(weaponBuildLikes, likeCond)
      .where(and(...conds))
      .orderBy(...orderBy)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const items: CommunityBuild[] = rows.slice(0, limit).flatMap((r) =>
      r.slug
        ? [
            {
              slug: r.slug,
              name: r.name,
              purpose: r.purpose,
              baseItemId: r.baseItemId,
              stats: r.stats,
              likes: r.likes,
              createdAt: r.createdAt.toISOString(),
              authorName: r.authorName ?? "Аноним",
              authorStreamer: r.authorStreamer,
              likedByMe: r.likedUserId != null,
            },
          ]
        : [],
    );

    return { items, nextOffset: hasMore ? offset + limit : null };
  } catch {
    return { items: [], nextOffset: null };
  }
}

/**
 * Тоггл лайка публичной сборки по slug. Дедуп через weapon_build_likes (PK build+user),
 * денормализованный счётчик weapon_builds.likes пересчитывается по факту.
 * Возвращает финальное состояние для оптимистичного UI.
 */
export async function toggleBuildLike(
  userId: string,
  slug: string,
): Promise<{ ok: boolean; liked: boolean; likes: number; error?: string }> {
  try {
    const [b] = await db
      .select({ id: weaponBuilds.id })
      .from(weaponBuilds)
      .where(and(eq(weaponBuilds.slug, slug), eq(weaponBuilds.isPublic, true)))
      .limit(1);
    if (!b) return { ok: false, liked: false, likes: 0, error: "Сборка не найдена" };

    const inserted = await db
      .insert(weaponBuildLikes)
      .values({ buildId: b.id, userId })
      .onConflictDoNothing()
      .returning({ buildId: weaponBuildLikes.buildId });

    let liked: boolean;
    if (inserted.length > 0) {
      liked = true;
    } else {
      await db
        .delete(weaponBuildLikes)
        .where(and(eq(weaponBuildLikes.buildId, b.id), eq(weaponBuildLikes.userId, userId)));
      liked = false;
    }

    const [c] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(weaponBuildLikes)
      .where(eq(weaponBuildLikes.buildId, b.id));
    const likes = c?.n ?? 0;

    await db.update(weaponBuilds).set({ likes }).where(eq(weaponBuilds.id, b.id));

    return { ok: true, liked, likes };
  } catch {
    return { ok: false, liked: false, likes: 0, error: "Не удалось обновить лайк" };
  }
}
