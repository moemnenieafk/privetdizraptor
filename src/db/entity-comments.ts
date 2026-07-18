// Обсуждения под сущностями портала. Только для сервера.
//
// Слой полиморфный: цель адресуется парой (targetType, targetId) — сборка, патч,
// статья Кодекса, босс, торговец. Реестр целей — src/lib/comment-targets.ts.
//
// Правила доступа (гейт живёт в роуте, здесь — данные и целостность):
//   читать    — все, включая анонимов
//   писать    — платный тир (operative/veteran) + модераторы/админ
//   голосовать— любой залогиненный, в том числе free
//   удалять   — автор (мягко) и модератор (скрытие)
//
// Голос дедуплится составным PK entity_comment_votes(comment_id, user_id).
// score денормализован в entity_comments.score — лента не считает агрегат джойном.
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { entityComments, entityCommentVotes, profiles, weaponBuilds } from "@/db/schema";
import type { CommentTargetType } from "@/lib/comment-targets";
import { karmaEvents } from "@/db/schema-comlink";

/** Порог, после которого автор комментария получает карму (разово). */
export const COMMENT_KARMA_THRESHOLD = 10;
const COMMENT_KARMA_DELTA = 3;

export const COMMENT_MAX_LEN = 1500;
export const COMMENT_MIN_LEN = 2;

export type CommentSort = "best" | "new";

export interface EntityComment {
  id: string;
  body: string;
  score: number;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorStreamer: boolean;
  /** Карма автора на момент чтения — бейдж доверия у ника. */
  authorKarma: number;
  /** Голосовал ли текущий зритель. */
  votedByMe: boolean;
  /** Скрыт модератором (отдаётся только автору и модераторам). */
  hidden: boolean;
}

/** id сборки по slug. null — сборки нет или снята с публикации. */
export async function buildIdBySlug(slug: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ id: weaponBuilds.id })
      .from(weaponBuilds)
      .where(and(eq(weaponBuilds.slug, slug), eq(weaponBuilds.isPublic, true)))
      .limit(1);
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Ветка под сущностью. Скрытые модератором строки видны только их автору и модераторам,
 * удалённые автором не отдаются никому. Устойчива к отсутствию таблицы → [].
 */
export async function getEntityComments(
  target: { type: CommentTargetType; id: string },
  opts: { sort: CommentSort; viewerId: string | null; viewerCanModerate: boolean },
): Promise<EntityComment[]> {
  try {
    const { sort, viewerId, viewerCanModerate } = opts;

    const voteCond = viewerId
      ? and(eq(entityCommentVotes.commentId, entityComments.id), eq(entityCommentVotes.userId, viewerId))
      : sql`false`;

    const karmaSub = sql<number>`(
      select coalesce(sum(${karmaEvents.delta}), 0)::int
      from ${karmaEvents}
      where ${karmaEvents.userId} = ${entityComments.userId}
    )`;

    const rows = await db
      .select({
        id: entityComments.id,
        body: entityComments.body,
        score: entityComments.score,
        createdAt: entityComments.createdAt,
        hiddenAt: entityComments.hiddenAt,
        authorId: entityComments.userId,
        authorName: profiles.username,
        authorAvatar: profiles.avatarUrl,
        authorStreamer: profiles.streamer,
        authorKarma: karmaSub,
        votedUserId: entityCommentVotes.userId,
      })
      .from(entityComments)
      .innerJoin(profiles, eq(profiles.id, entityComments.userId))
      .leftJoin(entityCommentVotes, voteCond)
      .where(
        and(
          eq(entityComments.targetType, target.type),
          eq(entityComments.targetId, target.id),
          isNull(entityComments.deletedAt),
        ),
      )
      .orderBy(
        ...(sort === "best"
          ? [desc(entityComments.score), desc(entityComments.createdAt)]
          : [desc(entityComments.createdAt)]),
      )
      .limit(200);

    return rows
      .filter((r) => r.hiddenAt === null || viewerCanModerate || r.authorId === viewerId)
      .map((r) => ({
        id: r.id,
        body: r.body,
        score: r.score,
        createdAt: r.createdAt.toISOString(),
        authorId: r.authorId,
        authorName: r.authorName ?? "Боец",
        authorAvatar: r.authorAvatar,
        authorStreamer: r.authorStreamer,
        authorKarma: r.authorKarma ?? 0,
        votedByMe: r.votedUserId != null,
        hidden: r.hiddenAt !== null,
      }));
  } catch {
    return [];
  }
}

export async function createComment(
  target: { type: CommentTargetType; id: string },
  userId: string,
  bodyRaw: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const body = bodyRaw.trim();
  if (body.length < COMMENT_MIN_LEN) return { ok: false, error: "Слишком короткий комментарий" };
  if (body.length > COMMENT_MAX_LEN) {
    return { ok: false, error: `Максимум ${COMMENT_MAX_LEN} символов` };
  }
  try {
    const [row] = await db
      .insert(entityComments)
      .values({ targetType: target.type, targetId: target.id, userId, body })
      .returning({ id: entityComments.id });
    return { ok: true, id: row?.id };
  } catch {
    return { ok: false, error: "Не удалось отправить комментарий" };
  }
}

/** Мягкое удаление автором. Модератор пользуется hideComment. */
export async function deleteOwnComment(commentId: string, userId: string): Promise<boolean> {
  try {
    const res = await db
      .update(entityComments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(entityComments.id, commentId), eq(entityComments.userId, userId)))
      .returning({ id: entityComments.id });
    return res.length > 0;
  } catch {
    return false;
  }
}

/** Скрытие/возврат модератором. */
export async function hideComment(
  commentId: string,
  moderatorId: string,
  hidden: boolean,
): Promise<boolean> {
  try {
    const res = await db
      .update(entityComments)
      .set({
        hiddenAt: hidden ? new Date() : null,
        hiddenBy: hidden ? moderatorId : null,
        updatedAt: new Date(),
      })
      .where(eq(entityComments.id, commentId))
      .returning({ id: entityComments.id });
    return res.length > 0;
  } catch {
    return false;
  }
}

/**
 * Тоггл голоса «полезно». Возвращает финальное состояние для оптимистичного UI.
 * Автор не может голосовать за себя — иначе рейтинг превращается в самонакрутку.
 * При достижении порога автору разово начисляется карма (журнал karma_events).
 */
export async function toggleCommentVote(
  commentId: string,
  userId: string,
): Promise<{ ok: boolean; voted: boolean; score: number; error?: string }> {
  try {
    const [c] = await db
      .select({ id: entityComments.id, authorId: entityComments.userId })
      .from(entityComments)
      .where(and(eq(entityComments.id, commentId), isNull(entityComments.deletedAt)))
      .limit(1);
    if (!c) return { ok: false, voted: false, score: 0, error: "Комментарий не найден" };
    if (c.authorId === userId) {
      return { ok: false, voted: false, score: 0, error: "Нельзя голосовать за свой комментарий" };
    }

    const inserted = await db
      .insert(entityCommentVotes)
      .values({ commentId, userId, value: 1 })
      .onConflictDoNothing()
      .returning({ commentId: entityCommentVotes.commentId });

    let voted: boolean;
    if (inserted.length > 0) {
      voted = true;
    } else {
      await db
        .delete(entityCommentVotes)
        .where(and(eq(entityCommentVotes.commentId, commentId), eq(entityCommentVotes.userId, userId)));
      voted = false;
    }

    const [agg] = await db
      .select({ n: sql<number>`coalesce(sum(${entityCommentVotes.value}), 0)::int` })
      .from(entityCommentVotes)
      .where(eq(entityCommentVotes.commentId, commentId));
    const score = agg?.n ?? 0;

    await db
      .update(entityComments)
      .set({ score, updatedAt: new Date() })
      .where(eq(entityComments.id, commentId));

    if (score >= COMMENT_KARMA_THRESHOLD) await grantCommentKarma(c.authorId, commentId);

    return { ok: true, voted, score };
  } catch {
    return { ok: false, voted: false, score: 0, error: "Не удалось учесть голос" };
  }
}

/**
 * Разовая карма за ценный комментарий. Дедуп проверкой наличия события: индекс
 * karma_events_dedupe_idx НЕ уникальный, поэтому onConflictDoNothing тут не спасает.
 */
async function grantCommentKarma(authorId: string, commentId: string): Promise<void> {
  const [exists] = await db
    .select({ id: karmaEvents.id })
    .from(karmaEvents)
    .where(
      and(
        eq(karmaEvents.userId, authorId),
        eq(karmaEvents.reason, "comment_valued"),
        eq(karmaEvents.refType, "comment"),
        eq(karmaEvents.refId, commentId),
      ),
    )
    .limit(1);
  if (exists) return;

  await db.insert(karmaEvents).values({
    userId: authorId,
    reason: "comment_valued",
    delta: COMMENT_KARMA_DELTA,
    refType: "comment",
    refId: commentId,
    issuedBy: null,
  });
}

/* ───────────────── лента модерации ───────────────── */

export interface ModerationComment extends EntityComment {
  targetType: CommentTargetType;
  targetId: string;
}

/**
 * Свежие комментарии по ВСЕМУ порталу — без этого модератор физически не увидит,
 * что написали под какой-нибудь дальней страницей. Скрытые тоже отдаются:
 * модератору нужно видеть, что он уже разобрал.
 */
export async function getRecentComments(limit = 100): Promise<ModerationComment[]> {
  try {
    const rows = await db
      .select({
        id: entityComments.id,
        body: entityComments.body,
        score: entityComments.score,
        createdAt: entityComments.createdAt,
        hiddenAt: entityComments.hiddenAt,
        targetType: entityComments.targetType,
        targetId: entityComments.targetId,
        authorId: entityComments.userId,
        authorName: profiles.username,
        authorAvatar: profiles.avatarUrl,
        authorStreamer: profiles.streamer,
      })
      .from(entityComments)
      .innerJoin(profiles, eq(profiles.id, entityComments.userId))
      .where(isNull(entityComments.deletedAt))
      .orderBy(desc(entityComments.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200));

    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      score: r.score,
      createdAt: r.createdAt.toISOString(),
      authorId: r.authorId,
      authorName: r.authorName ?? "Боец",
      authorAvatar: r.authorAvatar,
      authorStreamer: r.authorStreamer,
      authorKarma: 0,
      votedByMe: false,
      hidden: r.hiddenAt !== null,
      targetType: r.targetType,
      targetId: r.targetId,
    }));
  } catch {
    return [];
  }
}
