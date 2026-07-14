// Форум «Обсуждения»: темы + ответы. Только для сервера.
//
// Модерация встроена с первого дня (решение V4DYA: анкеты и посты идут в эфир сразу,
// без премодерации — разгребаем по жалобам): pin/lock тем, hide постов, очередь
// comlink_reports. Права: role 'admin' | 'moderator'.
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import {
  comlinkPosts,
  comlinkReports,
  comlinkTopics,
  type ReportStatus,
} from "@/db/schema-comlink";
import { getKarmaMap, grantKarma, type KarmaInfo } from "@/db/comlink";
import { eftGameId } from "@/db/eft";

// Канон прав — src/lib/auth/roles.ts. Здесь реэкспорт: импорты по проекту уже смотрят сюда.
export { canModerate } from "@/lib/auth/roles";

/* ─────────────────── список тем ─────────────────── */

export interface TopicListItem {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorKarma: KarmaInfo;
  locked: boolean;
  pinned: boolean;
  replyCount: number;
  lastReplyAt: string | null;
  createdAt: string;
}

export async function getTopics(limit = 30, offset = 0): Promise<{ items: TopicListItem[]; total: number }> {
  const gameId = await eftGameId();

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        t: comlinkTopics,
        authorName: profiles.username,
        authorAvatar: profiles.avatarUrl,
      })
      .from(comlinkTopics)
      .innerJoin(profiles, eq(profiles.id, comlinkTopics.authorId))
      .where(eq(comlinkTopics.gameId, gameId))
      .orderBy(
        desc(comlinkTopics.pinned),
        desc(sql`coalesce(${comlinkTopics.lastReplyAt}, ${comlinkTopics.createdAt})`),
      )
      .limit(Math.min(limit, 50))
      .offset(Math.max(offset, 0)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(comlinkTopics)
      .where(eq(comlinkTopics.gameId, gameId)),
  ]);

  const karma = await getKarmaMap(rows.map((r) => r.t.authorId));

  return {
    items: rows.map((r) => ({
      id: r.t.id,
      title: r.t.title,
      authorId: r.t.authorId,
      authorName: r.authorName ?? "Боец",
      authorAvatar: r.authorAvatar,
      authorKarma: karma.get(r.t.authorId) ?? { total: 0, tierId: "wild", tierLabel: "Дикий" },
      locked: r.t.locked,
      pinned: r.t.pinned,
      replyCount: r.t.replyCount,
      lastReplyAt: r.t.lastReplyAt ? r.t.lastReplyAt.toISOString() : null,
      createdAt: r.t.createdAt.toISOString(),
    })),
    total: count,
  };
}

/* ─────────────────── тема + ответы ─────────────────── */

export interface PostItem {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorKarma: KarmaInfo;
  body: string;
  hidden: boolean;
  createdAt: string;
}

export interface TopicDetail extends TopicListItem {
  body: string;
  posts: PostItem[];
}

export async function getTopic(topicId: string): Promise<TopicDetail | null> {
  const [row] = await db
    .select({
      t: comlinkTopics,
      authorName: profiles.username,
      authorAvatar: profiles.avatarUrl,
    })
    .from(comlinkTopics)
    .innerJoin(profiles, eq(profiles.id, comlinkTopics.authorId))
    .where(eq(comlinkTopics.id, topicId))
    .limit(1);

  if (!row) return null;

  const postRows = await db
    .select({
      p: comlinkPosts,
      authorName: profiles.username,
      authorAvatar: profiles.avatarUrl,
    })
    .from(comlinkPosts)
    .innerJoin(profiles, eq(profiles.id, comlinkPosts.authorId))
    .where(eq(comlinkPosts.topicId, topicId))
    .orderBy(comlinkPosts.createdAt)
    .limit(200);

  const karma = await getKarmaMap([row.t.authorId, ...postRows.map((r) => r.p.authorId)]);
  const k = (id: string): KarmaInfo =>
    karma.get(id) ?? { total: 0, tierId: "wild", tierLabel: "Дикий" };

  return {
    id: row.t.id,
    title: row.t.title,
    body: row.t.body,
    authorId: row.t.authorId,
    authorName: row.authorName ?? "Боец",
    authorAvatar: row.authorAvatar,
    authorKarma: k(row.t.authorId),
    locked: row.t.locked,
    pinned: row.t.pinned,
    replyCount: row.t.replyCount,
    lastReplyAt: row.t.lastReplyAt ? row.t.lastReplyAt.toISOString() : null,
    createdAt: row.t.createdAt.toISOString(),
    posts: postRows.map((r) => ({
      id: r.p.id,
      authorId: r.p.authorId,
      authorName: r.authorName ?? "Боец",
      authorAvatar: r.authorAvatar,
      authorKarma: k(r.p.authorId),
      // Скрытый пост: текст наружу не отдаём, но строку оставляем — видно, что
      // модератор поработал (и жалобы могут ссылаться на id).
      body: r.p.hidden ? "" : r.p.body,
      hidden: r.p.hidden,
      createdAt: r.p.createdAt.toISOString(),
    })),
  };
}

/* ─────────────────── создание ─────────────────── */

export async function createTopic(
  authorId: string,
  title: string,
  body: string,
): Promise<{ ok: boolean; error?: string; topicId?: string }> {
  const gameId = await eftGameId();

  const [row] = await db
    .insert(comlinkTopics)
    .values({ gameId, authorId, title, body })
    .returning({ id: comlinkTopics.id });

  return { ok: true, topicId: row.id };
}

export async function createPost(
  topicId: string,
  authorId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const [topic] = await db
    .select({ locked: comlinkTopics.locked })
    .from(comlinkTopics)
    .where(eq(comlinkTopics.id, topicId))
    .limit(1);

  if (!topic) return { ok: false, error: "Тема не найдена" };
  if (topic.locked) return { ok: false, error: "Тема закрыта модератором" };

  await db.insert(comlinkPosts).values({ topicId, authorId, body });
  await db
    .update(comlinkTopics)
    .set({ replyCount: sql`${comlinkTopics.replyCount} + 1`, lastReplyAt: sql`now()` })
    .where(eq(comlinkTopics.id, topicId));

  return { ok: true };
}

/* ─────────────────── модерация ─────────────────── */

export type ModAction =
  | { type: "pin"; topicId: string; value: boolean }
  | { type: "lock"; topicId: string; value: boolean }
  | { type: "hide_post"; postId: string; value: boolean };

export async function moderate(action: ModAction): Promise<void> {
  switch (action.type) {
    case "pin":
      await db
        .update(comlinkTopics)
        .set({ pinned: action.value })
        .where(eq(comlinkTopics.id, action.topicId));
      return;
    case "lock":
      await db
        .update(comlinkTopics)
        .set({ locked: action.value })
        .where(eq(comlinkTopics.id, action.topicId));
      return;
    case "hide_post":
      await db
        .update(comlinkPosts)
        .set({ hidden: action.value })
        .where(eq(comlinkPosts.id, action.postId));
      return;
  }
}

/* ─────────────────── жалобы ─────────────────── */

export async function createReport(
  reporterId: string,
  targetId: string,
  refType: string,
  refId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  // Дубль от того же жалобщика на тот же объект не плодим.
  const [existing] = await db
    .select({ id: comlinkReports.id })
    .from(comlinkReports)
    .where(
      and(
        eq(comlinkReports.reporterId, reporterId),
        eq(comlinkReports.refType, refType),
        eq(comlinkReports.refId, refId),
        eq(comlinkReports.status, "open"),
      ),
    )
    .limit(1);

  if (existing) return { ok: false, error: "Вы уже пожаловались — жалоба в очереди" };

  await db
    .insert(comlinkReports)
    .values({ reporterId, targetId, refType, refId, reason: reason.slice(0, 300) });

  return { ok: true };
}

export interface ReportQueueItem {
  id: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  refType: string;
  refId: string;
  reason: string;
  createdAt: string;
}

export async function getOpenReports(): Promise<ReportQueueItem[]> {
  const rows = await db
    .select({
      r: comlinkReports,
      reporterName: sql<string | null>`rep.username`,
      targetName: sql<string | null>`tgt.username`,
    })
    .from(comlinkReports)
    .innerJoin(sql`${profiles} as rep`, sql`rep.id = ${comlinkReports.reporterId}`)
    .innerJoin(sql`${profiles} as tgt`, sql`tgt.id = ${comlinkReports.targetId}`)
    .where(eq(comlinkReports.status, "open"))
    .orderBy(comlinkReports.createdAt)
    .limit(100);

  return rows.map((r) => ({
    id: r.r.id,
    reporterName: r.reporterName ?? "Боец",
    targetId: r.r.targetId,
    targetName: r.targetName ?? "Боец",
    refType: r.r.refType,
    refId: r.r.refId,
    reason: r.r.reason,
    createdAt: r.r.createdAt.toISOString(),
  }));
}

/**
 * Разбор жалобы. upheld → цели −25 кармы (report_upheld, идемпотентно по id жалобы).
 * Сокрытие контента модератор делает отдельным действием — жалоба может быть
 * справедливой, а пост при этом достаточно отредактировать словами в теме.
 */
export async function resolveReport(
  reportId: string,
  moderatorId: string,
  status: Exclude<ReportStatus, "open">,
): Promise<{ ok: boolean; error?: string }> {
  const [report] = await db
    .select()
    .from(comlinkReports)
    .where(eq(comlinkReports.id, reportId))
    .limit(1);

  if (!report) return { ok: false, error: "Жалоба не найдена" };
  if (report.status !== "open") return { ok: false, error: "Жалоба уже разобрана" };

  await db
    .update(comlinkReports)
    .set({ status, resolvedBy: moderatorId, resolvedAt: sql`now()` })
    .where(eq(comlinkReports.id, reportId));

  if (status === "upheld") {
    await grantKarma(report.targetId, "report_upheld", -25, "report", reportId, moderatorId);
  }

  return { ok: true };
}
