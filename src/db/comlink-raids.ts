// Рейды и отзывы раздела «Связь» — ядро кармы. Только для сервера.
//
// Жизненный цикл заявки:
//   pending ──(партнёр подтвердил ≤48ч)──► confirmed → +5 кармы обоим, открыто окно
//      │                                     взаимной оценки 72ч (отзывы скрыты до
//      │                                     обоюдной сдачи или дедлайна — анти-месть)
//      ├──(партнёр отклонил)──► declined   (кармы нет, в статистику не идёт)
//      └──(48ч тишины)──────► expired      (лениво, при любом чтении — крона нет)
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import {
  comlinkRaids,
  comlinkReviews,
  type ComlinkRaidRow,
  type RaidStatus,
} from "@/db/schema-comlink";
import { grantKarma } from "@/db/comlink";
import { getActiveSherpaIds } from "@/db/sherpa";
import { eftGameId } from "@/db/eft";

const PENDING_TTL_MS = 48 * 60 * 60 * 1000; // подтверждение
const REVIEW_TTL_MS = 72 * 60 * 60 * 1000; // окно оценки после confirm

/* ─────────────────── ленивые дедлайны (без крона) ─────────────────── */

/** Протухшие pending → expired. Зовётся при каждом чтении списка — дёшево. */
async function expireStalePending(): Promise<void> {
  const cutoff = new Date(Date.now() - PENDING_TTL_MS);
  await db
    .update(comlinkRaids)
    .set({ status: "expired", resolvedAt: sql`now()` })
    .where(and(eq(comlinkRaids.status, "pending"), lt(comlinkRaids.createdAt, cutoff)));
}

/** Раскрытие отзывов: обе стороны сдали ИЛИ 72ч после confirm. */
async function revealDueReviews(): Promise<void> {
  // Обоюдная сдача: у рейда 2 отзыва → показываем оба.
  await db.execute(sql`
    update comlink_reviews r set hidden = false
    where r.hidden = true
      and (select count(*) from comlink_reviews r2 where r2.raid_id = r.raid_id) = 2
  `);
  // Дедлайн: 72ч после подтверждения рейда.
  await db.execute(sql`
    update comlink_reviews r set hidden = false
    where r.hidden = true
      and exists (
        select 1 from comlink_raids cr
        where cr.id = r.raid_id
          and cr.status = 'confirmed'
          and cr.resolved_at < now() - interval '72 hours'
      )
  `);
}

/* ─────────────────── заявки ─────────────────── */

export interface CreateRaidResult {
  ok: boolean;
  error?: string;
  raidId?: string;
}

/** Позвать игрока в рейд. Дубли гасим: один живой pending на пару. */
export async function createRaid(
  initiatorId: string,
  partnerId: string,
  note: string,
): Promise<CreateRaidResult> {
  if (initiatorId === partnerId) return { ok: false, error: "Нельзя позвать самого себя" };

  const gameId = await eftGameId();

  const [existing] = await db
    .select({ id: comlinkRaids.id })
    .from(comlinkRaids)
    .where(
      and(
        eq(comlinkRaids.status, "pending"),
        or(
          and(eq(comlinkRaids.initiatorId, initiatorId), eq(comlinkRaids.partnerId, partnerId)),
          and(eq(comlinkRaids.initiatorId, partnerId), eq(comlinkRaids.partnerId, initiatorId)),
        ),
      ),
    )
    .limit(1);

  if (existing) return { ok: false, error: "Заявка между вами уже висит — дождитесь ответа" };

  const [row] = await db
    .insert(comlinkRaids)
    .values({ gameId, initiatorId, partnerId, note: note.slice(0, 200) })
    .returning({ id: comlinkRaids.id });

  return { ok: true, raidId: row.id };
}

/** Ответ на заявку. Подтверждение = +5 кармы обоим (идемпотентно по dedupe-индексу). */
export async function resolveRaid(
  raidId: string,
  userId: string,
  accept: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const [raid] = await db
    .select()
    .from(comlinkRaids)
    .where(eq(comlinkRaids.id, raidId))
    .limit(1);

  if (!raid) return { ok: false, error: "Заявка не найдена" };
  if (raid.partnerId !== userId) return { ok: false, error: "Ответить может только приглашённый" };
  if (raid.status !== "pending") return { ok: false, error: "Заявка уже разрешена" };
  if (Date.now() - raid.createdAt.getTime() > PENDING_TTL_MS) {
    await db
      .update(comlinkRaids)
      .set({ status: "expired", resolvedAt: sql`now()` })
      .where(eq(comlinkRaids.id, raidId));
    return { ok: false, error: "Заявка протухла (48 часов)" };
  }

  const status: RaidStatus = accept ? "confirmed" : "declined";
  await db
    .update(comlinkRaids)
    .set({ status, resolvedAt: sql`now()` })
    .where(eq(comlinkRaids.id, raidId));

  if (accept) {
    // Сессия с шерпой: наставник получает +15 (sherpa_session) вместо +5.
    // «Кто шерпа» — по активной анкете goal='sherpa' на момент подтверждения.
    const sherpas = await getActiveSherpaIds([raid.initiatorId, raid.partnerId]);

    for (const uid of [raid.initiatorId, raid.partnerId]) {
      if (sherpas.has(uid)) await grantKarma(uid, "sherpa_session", 15, "raid", raidId);
      else await grantKarma(uid, "raid_confirmed", 5, "raid", raidId);
    }
  }

  return { ok: true };
}

/* ─────────────────── отзывы ─────────────────── */

export async function submitReview(
  raidId: string,
  authorId: string,
  positive: boolean,
  comment: string,
): Promise<{ ok: boolean; error?: string }> {
  const [raid] = await db
    .select()
    .from(comlinkRaids)
    .where(eq(comlinkRaids.id, raidId))
    .limit(1);

  if (!raid) return { ok: false, error: "Рейд не найден" };
  if (raid.status !== "confirmed") return { ok: false, error: "Оценить можно только подтверждённый рейд" };
  if (raid.initiatorId !== authorId && raid.partnerId !== authorId) {
    return { ok: false, error: "Оценивают только участники рейда" };
  }
  if (raid.resolvedAt && Date.now() - raid.resolvedAt.getTime() > REVIEW_TTL_MS) {
    return { ok: false, error: "Окно оценки закрыто (72 часа после подтверждения)" };
  }

  const trimmed = comment.trim().slice(0, 300);
  // Отрицательный отзыв без объяснения — топливо для войн сливов. Требуем текст.
  if (!positive && trimmed.length < 10) {
    return { ok: false, error: "Отрицательный отзыв — только с пояснением (от 10 символов)" };
  }

  const targetId = raid.initiatorId === authorId ? raid.partnerId : raid.initiatorId;

  const inserted = await db
    .insert(comlinkReviews)
    .values({ raidId, authorId, targetId, positive, comment: trimmed })
    .onConflictDoNothing()
    .returning({ raidId: comlinkReviews.raidId });

  if (inserted.length === 0) return { ok: false, error: "Вы уже оценили этот рейд" };

  // Карма: +10 цели за плюс; −2 цели и −1 автору за минус (асимметрия SO — минус
  // стоит и тому, кто его ставит, чтобы на него надо было решиться).
  if (positive) {
    await grantKarma(targetId, "review_positive", 10, "review", `${raidId}:${authorId}`);
  } else {
    await grantKarma(targetId, "review_negative", -2, "review", `${raidId}:${authorId}`);
    await grantKarma(authorId, "review_cost", -1, "review", `${raidId}:${authorId}`);
  }

  await revealDueReviews();
  return { ok: true };
}

/* ─────────────────── мои рейды (входящие/исходящие/на оценку) ─────────────────── */

export interface RaidListItem {
  id: string;
  role: "initiator" | "partner";
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  status: RaidStatus;
  note: string;
  createdAt: string;
  resolvedAt: string | null;
  /** Я уже оценил этот рейд. */
  reviewed: boolean;
  /** Окно оценки ещё открыто. */
  canReview: boolean;
}

export async function getMyRaids(userId: string): Promise<RaidListItem[]> {
  await expireStalePending();
  await revealDueReviews();

  const rows = await db
    .select({
      raid: comlinkRaids,
      initiatorName: sql<string | null>`pi.username`,
      initiatorAvatar: sql<string | null>`pi.avatar_url`,
      partnerName: sql<string | null>`pp.username`,
      partnerAvatar: sql<string | null>`pp.avatar_url`,
    })
    .from(comlinkRaids)
    .innerJoin(sql`${profiles} as pi`, sql`pi.id = ${comlinkRaids.initiatorId}`)
    .innerJoin(sql`${profiles} as pp`, sql`pp.id = ${comlinkRaids.partnerId}`)
    .where(or(eq(comlinkRaids.initiatorId, userId), eq(comlinkRaids.partnerId, userId)))
    .orderBy(desc(comlinkRaids.createdAt))
    .limit(50);

  const raidIds = rows.map((r) => r.raid.id);
  const myReviews = raidIds.length
    ? await db
        .select({ raidId: comlinkReviews.raidId })
        .from(comlinkReviews)
        .where(and(eq(comlinkReviews.authorId, userId), sql`${comlinkReviews.raidId} in ${raidIds}`))
    : [];
  const reviewedSet = new Set(myReviews.map((r) => r.raidId));

  return rows.map((r) => {
    const isInitiator = r.raid.initiatorId === userId;
    const reviewed = reviewedSet.has(r.raid.id);
    const withinWindow =
      r.raid.status === "confirmed" &&
      r.raid.resolvedAt !== null &&
      Date.now() - r.raid.resolvedAt.getTime() <= REVIEW_TTL_MS;

    return {
      id: r.raid.id,
      role: isInitiator ? "initiator" : "partner",
      otherId: isInitiator ? r.raid.partnerId : r.raid.initiatorId,
      otherName: (isInitiator ? r.partnerName : r.initiatorName) ?? "Боец",
      otherAvatar: isInitiator ? r.partnerAvatar : r.initiatorAvatar,
      status: r.raid.status,
      note: r.raid.note,
      createdAt: r.raid.createdAt.toISOString(),
      resolvedAt: r.raid.resolvedAt ? r.raid.resolvedAt.toISOString() : null,
      reviewed,
      canReview: withinWindow && !reviewed,
    } satisfies RaidListItem;
  });
}

export type { ComlinkRaidRow };
