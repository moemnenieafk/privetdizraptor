// «Биржа шерпов» — наставники поверх той же инфраструктуры: анкета с goal='sherpa',
// сессии = те же comlink_raids, где партнёр — шерпа. Отдельной таблицы сессий НЕТ
// намеренно: один механизм подтверждения, одна карма, один код.
//
// Отличие от обычного рейда — начисление: подтверждённый рейд с шерпой даёт шерпе
// +15 (sherpa_session) ВМЕСТО +5, ученику — обычные +5. «Кто шерпа» определяется
// анкетой на момент подтверждения.
//
// Только для сервера.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { comlinkProfiles, comlinkRaids, comlinkReviews } from "@/db/schema-comlink";
import { getCandidates, type CandidateListItem } from "@/db/comlink";
import { eftGameId } from "@/db/eft";

/** Строка биржи: анкета шерпы + статистика наставничества. */
export interface SherpaListItem extends CandidateListItem {
  /** Проведено подтверждённых сессий (рейды, где он был шерпой). */
  sessions: number;
  /** Доля положительных отзывов о нём, 0..1. null — отзывов ещё нет. */
  positiveShare: number | null;
}

/** Шерпы: анкеты goal='sherpa' + счётчики сессий и отзывов. */
export async function getSherpas(): Promise<{ items: SherpaListItem[]; total: number }> {
  const base = await getCandidates({ goal: "sherpa", limit: 50 });
  if (base.items.length === 0) return { items: [], total: 0 };

  const ids = base.items.map((i) => i.userId);

  const [sessionRows, reviewRows] = await Promise.all([
    // Сессии шерпы = подтверждённые рейды с его участием (уже есть в confirmedRaids,
    // но здесь считаем ТОЛЬКО те, где вторая сторона — не шерпа, т.е. учебные).
    // Упрощение первой версии: берём все confirmed — расхождение исчезнет, когда
    // появится флаг сессии; для сортировки биржи этого достаточно.
    db
      .select({
        initiatorId: comlinkRaids.initiatorId,
        partnerId: comlinkRaids.partnerId,
      })
      .from(comlinkRaids)
      .where(
        and(
          eq(comlinkRaids.status, "confirmed"),
          sql`(${comlinkRaids.initiatorId} in ${ids} or ${comlinkRaids.partnerId} in ${ids})`,
        ),
      ),
    db
      .select({
        targetId: comlinkReviews.targetId,
        positive: comlinkReviews.positive,
      })
      .from(comlinkReviews)
      .where(and(eq(comlinkReviews.hidden, false), inArray(comlinkReviews.targetId, ids))),
  ]);

  const sessions = new Map<string, number>();
  for (const r of sessionRows) {
    for (const id of [r.initiatorId, r.partnerId]) {
      if (ids.includes(id)) sessions.set(id, (sessions.get(id) ?? 0) + 1);
    }
  }

  const reviews = new Map<string, { pos: number; total: number }>();
  for (const r of reviewRows) {
    const cur = reviews.get(r.targetId) ?? { pos: 0, total: 0 };
    cur.total += 1;
    if (r.positive) cur.pos += 1;
    reviews.set(r.targetId, cur);
  }

  const items: SherpaListItem[] = base.items.map((i) => {
    const rev = reviews.get(i.userId);
    return {
      ...i,
      sessions: sessions.get(i.userId) ?? 0,
      positiveShare: rev && rev.total > 0 ? rev.pos / rev.total : null,
    };
  });

  // Биржа сортируется по опыту наставника: сессии ↓, потом карма ↓.
  items.sort((a, b) => b.sessions - a.sessions || b.karma.total - a.karma.total);

  return { items, total: base.total };
}

/** userId'ы действующих шерпов (активная анкета goal='sherpa') — для бонуса кармы. */
export async function getActiveSherpaIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const gameId = await eftGameId();

  const rows = await db
    .select({ userId: comlinkProfiles.userId })
    .from(comlinkProfiles)
    .where(
      and(
        eq(comlinkProfiles.gameId, gameId),
        eq(comlinkProfiles.goal, "sherpa"),
        eq(comlinkProfiles.active, true),
        inArray(comlinkProfiles.userId, userIds),
      ),
    );

  return new Set(rows.map((r) => r.userId));
}
