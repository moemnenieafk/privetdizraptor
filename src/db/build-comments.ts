// Комментарии к опубликованным сборкам. Только для сервера.
//
// Правила доступа (гейт живёт в роуте, здесь — данные и целостность):
//   читать    — все, включая анонимов
//   писать    — платный тир (operative/veteran) + модераторы/админ
//   голосовать— любой залогиненный, в том числе free
//   удалять   — автор (мягко) и модератор (скрытие)
//
// Голос дедуплится составным PK build_comment_votes(comment_id, user_id).
// score денормализован в build_comments.score — лента не считает агрегат джойном.
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { buildComments, buildCommentVotes, profiles, weaponBuilds } from "@/db/schema";
import { karmaEvents } from "@/db/schema-comlink";

/** Порог, после которого автор комментария получает карму (разово). */
export const COMMENT_KARMA_THRESHOLD = 10;
const COMMENT_KARMA_DELTA = 3;

export const COMMENT_MAX_LEN = 1500;
export const COMMENT_MIN_LEN = 2;

export type CommentSort = "best" | "new";

export interface BuildComment {
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
 * Ветка под сборкой. Скрытые модератором строки видны только их автору и модераторам,
 * удалённые автором не отдаются никому. Устойчива к отсутствию таблицы → [].
 */
export async function getBuildComments(
  buildId: string,
  opts: { sort: CommentSort; viewerId: string | null; viewerCanModerate: boolean },
): Promise<BuildComment[]> {
  try {
    const { sort, viewerId, viewerCanModerate } = opts;

    const voteCond = viewerId
      ? and(eq(buildCommentVotes.commentId, buildComments.id), eq(buildCommentVotes.userId, viewerId))
      : sql`false`;

    const karmaSub = sql<number>`(
      select coalesce(sum(${karmaEvents.delta}), 0)::int
      from ${karmaEvents}
      where ${karmaEvents.userId} = ${buildComments.userId}
    )`;

    const rows = await db
      .select({
        id: buildComments.id,
        body: buildComments.body,
        score: buildComments.score,
        createdAt: buildComments.createdAt,
        hiddenAt: buildComments.hiddenAt,
        authorId: buildComments.userId,
        authorName: profiles.username,
        authorAvatar: profiles.avatarUrl,
        authorStreamer: profiles.streamer,
        authorKarma: karmaSub,
        votedUserId: buildCommentVotes.userId,
      })
      .from(buildComments)
      .innerJoin(profiles, eq(profiles.id, buildComments.userId))
      .leftJoin(buildCommentVotes, voteCond)
      .where(and(eq(buildComments.buildId, buildId), isNull(buildComments.deletedAt)))
      .orderBy(
        ...(sort === "best"
          ? [desc(buildComments.score), desc(buildComments.createdAt)]
          : [desc(buildComments.createdAt)]),
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
  buildId: string,
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
      .insert(buildComments)
      .values({ buildId, userId, body })
      .returning({ id: buildComments.id });
    return { ok: true, id: row?.id };
  } catch {
    return { ok: false, error: "Не удалось отправить комментарий" };
  }
}

/** Мягкое удаление автором. Модератор пользуется hideComment. */
export async function deleteOwnComment(commentId: string, userId: string): Promise<boolean> {
  try {
    const res = await db
      .update(buildComments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(buildComments.id, commentId), eq(buildComments.userId, userId)))
      .returning({ id: buildComments.id });
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
      .update(buildComments)
      .set({
        hiddenAt: hidden ? new Date() : null,
        hiddenBy: hidden ? moderatorId : null,
        updatedAt: new Date(),
      })
      .where(eq(buildComments.id, commentId))
      .returning({ id: buildComments.id });
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
      .select({ id: buildComments.id, authorId: buildComments.userId })
      .from(buildComments)
      .where(and(eq(buildComments.id, commentId), isNull(buildComments.deletedAt)))
      .limit(1);
    if (!c) return { ok: false, voted: false, score: 0, error: "Комментарий не найден" };
    if (c.authorId === userId) {
      return { ok: false, voted: false, score: 0, error: "Нельзя голосовать за свой комментарий" };
    }

    const inserted = await db
      .insert(buildCommentVotes)
      .values({ commentId, userId, value: 1 })
      .onConflictDoNothing()
      .returning({ commentId: buildCommentVotes.commentId });

    let voted: boolean;
    if (inserted.length > 0) {
      voted = true;
    } else {
      await db
        .delete(buildCommentVotes)
        .where(and(eq(buildCommentVotes.commentId, commentId), eq(buildCommentVotes.userId, userId)));
      voted = false;
    }

    const [agg] = await db
      .select({ n: sql<number>`coalesce(sum(${buildCommentVotes.value}), 0)::int` })
      .from(buildCommentVotes)
      .where(eq(buildCommentVotes.commentId, commentId));
    const score = agg?.n ?? 0;

    await db
      .update(buildComments)
      .set({ score, updatedAt: new Date() })
      .where(eq(buildComments.id, commentId));

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
