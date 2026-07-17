// Читалки и мутации подтверждения ЧВК-профиля («галочка»). Только для сервера
// (Drizzle owner-ролью, мимо RLS — безопасность держит сессия в API-роутах).
//
// Механизм ручной (BSG не отдаёт владение профилем): выдаём одноразовый код →
// юзер шлёт скрин игрового профиля с этим кодом в кадре → модератор «Связь»
// сверяет заявленный ник и подтверждает/отклоняет. Один активный запрос на
// юзера+игру (PK user_id+game_id).
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import { profiles, playerProfiles } from "@/db/schema";
import {
  playerVerifications,
  type VerificationProof,
  type VerificationStatus,
} from "@/db/schema-comlink";
import { eftGameId } from "@/db/eft";

/* ─────────────────── одноразовый код ─────────────────── */

// Без похожих символов (0/O, 1/I) — код вписывают руками в кадр скрина.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Код-челлендж вида «A7KM-9QF4»: две группы по 4, крипто-стойкий выбор. */
export function genVerificationCode(): string {
  const pick = (): string => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  const group = (): string => pick() + pick() + pick() + pick();
  return `${group()}-${group()}`;
}

/* ─────────────────── активный ЧВК-ник ─────────────────── */

/** Ник активного облачного ЧВК-профиля (снимок для верификации). null — профилей нет. */
async function activeNickname(userId: string, gameId: string): Promise<string | null> {
  const [pp] = await db
    .select({ profiles: playerProfiles.profiles, activeId: playerProfiles.activeProfileId })
    .from(playerProfiles)
    .where(and(eq(playerProfiles.userId, userId), eq(playerProfiles.gameId, gameId)))
    .limit(1);
  if (!pp) return null;
  const active = pp.profiles.find((x) => x.id === pp.activeId) ?? pp.profiles[0];
  return active?.nickname ?? null;
}

/* ─────────────────── моя верификация ─────────────────── */

/** Вид «моей верификации» для UI (без сырого base64 пруфа — только факт наличия). */
export interface MyVerificationView {
  status: VerificationStatus;
  claimedNickname: string;
  /** Код показываем только пока ждём скрин (awaiting/rejected) — чтобы вписать в кадр. */
  code: string | null;
  accountRef: string | null;
  note: string;
  hasProof: boolean;
  updatedAt: string;
}

export async function getMyVerification(userId: string): Promise<MyVerificationView | null> {
  const gameId = await eftGameId();
  const [row] = await db
    .select()
    .from(playerVerifications)
    .where(and(eq(playerVerifications.userId, userId), eq(playerVerifications.gameId, gameId)))
    .limit(1);
  if (!row) return null;

  const showCode = row.status === "awaiting" || row.status === "rejected";
  return {
    status: row.status,
    claimedNickname: row.claimedNickname,
    code: showCode ? row.code : null,
    accountRef: row.accountRef,
    note: row.note,
    hasProof: row.proof !== null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* ─────────────────── старт: выдать код ─────────────────── */

/**
 * Начать/перевыпустить верификацию: фиксирует снимок активного ЧВК-ника и выдаёт
 * новый одноразовый код (статус awaiting). Разрешено из «пусто», awaiting и rejected
 * (повторная попытка). Из pending/approved — нет (в очереди/уже подтверждён).
 */
export async function startVerification(
  userId: string,
): Promise<{ ok: boolean; error?: string; code?: string; claimedNickname?: string }> {
  const gameId = await eftGameId();

  const [existing] = await db
    .select({ status: playerVerifications.status })
    .from(playerVerifications)
    .where(and(eq(playerVerifications.userId, userId), eq(playerVerifications.gameId, gameId)))
    .limit(1);

  if (existing?.status === "pending") {
    return { ok: false, error: "Заявка уже на проверке у модератора" };
  }
  if (existing?.status === "approved") {
    return { ok: false, error: "Профиль уже подтверждён" };
  }

  const nickname = await activeNickname(userId, gameId);
  if (!nickname) {
    return { ok: false, error: "Сначала создайте ЧВК-профиль в трекере" };
  }

  const code = genVerificationCode();

  await db
    .insert(playerVerifications)
    .values({ userId, gameId, status: "awaiting", claimedNickname: nickname, code })
    .onConflictDoUpdate({
      target: [playerVerifications.userId, playerVerifications.gameId],
      set: {
        status: "awaiting",
        claimedNickname: nickname,
        code,
        proof: null,
        accountRef: null,
        note: "",
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: sql`now()`,
      },
    });

  return { ok: true, code, claimedNickname: nickname };
}

/* ─────────────────── отправка скрина ─────────────────── */

/** Отправить пруф на модерацию: awaiting/rejected → pending. */
export async function submitVerification(
  userId: string,
  proof: VerificationProof,
  accountRef: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const gameId = await eftGameId();

  const [row] = await db
    .select({ status: playerVerifications.status })
    .from(playerVerifications)
    .where(and(eq(playerVerifications.userId, userId), eq(playerVerifications.gameId, gameId)))
    .limit(1);

  if (!row) return { ok: false, error: "Сначала получите код" };
  if (row.status === "pending") return { ok: false, error: "Заявка уже на проверке" };
  if (row.status === "approved") return { ok: false, error: "Профиль уже подтверждён" };

  await db
    .update(playerVerifications)
    .set({ status: "pending", proof, accountRef, note: "", updatedAt: sql`now()` })
    .where(and(eq(playerVerifications.userId, userId), eq(playerVerifications.gameId, gameId)));

  return { ok: true };
}

/* ─────────────────── очередь модерации ─────────────────── */

export interface VerificationQueueItem {
  userId: string;
  username: string;
  avatarUrl: string | null;
  claimedNickname: string;
  code: string;
  accountRef: string | null;
  proof: VerificationProof | null;
  createdAt: string;
}

/** Открытые заявки (status=pending) для модератора. Пруф отдаём — модератору сверять. */
export async function getPendingVerifications(): Promise<VerificationQueueItem[]> {
  const gameId = await eftGameId();
  const rows = await db
    .select({
      v: playerVerifications,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
    })
    .from(playerVerifications)
    .innerJoin(profiles, eq(profiles.id, playerVerifications.userId))
    .where(and(eq(playerVerifications.gameId, gameId), eq(playerVerifications.status, "pending")))
    .orderBy(playerVerifications.updatedAt)
    .limit(100);

  return rows.map((r) => ({
    userId: r.v.userId,
    username: r.username ?? "Боец",
    avatarUrl: r.avatarUrl,
    claimedNickname: r.v.claimedNickname,
    code: r.v.code,
    accountRef: r.v.accountRef,
    proof: r.v.proof,
    createdAt: r.v.createdAt.toISOString(),
  }));
}

/** Разбор заявки модератором: pending → approved | rejected. При approve пруф чистим. */
export async function reviewVerification(
  moderatorId: string,
  targetUserId: string,
  decision: "approved" | "rejected",
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const gameId = await eftGameId();

  const [row] = await db
    .select({ status: playerVerifications.status })
    .from(playerVerifications)
    .where(
      and(eq(playerVerifications.userId, targetUserId), eq(playerVerifications.gameId, gameId)),
    )
    .limit(1);

  if (!row) return { ok: false, error: "Заявка не найдена" };
  if (row.status !== "pending") return { ok: false, error: "Заявка уже разобрана" };

  await db
    .update(playerVerifications)
    .set({
      status: decision,
      note: decision === "rejected" ? note.slice(0, 300) : "",
      // Одобрили — сырой скрин больше не нужен, не держим ПДн лишнего.
      // Отклонили — proof оставляем как есть (в set не включаем).
      ...(decision === "approved" ? { proof: null } : {}),
      reviewedBy: moderatorId,
      reviewedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      and(eq(playerVerifications.userId, targetUserId), eq(playerVerifications.gameId, gameId)),
    );

  return { ok: true };
}

/* ─────────────────── карта подтверждённых (для списков) ─────────────────── */

/** userId → подтверждённый ЧВК-ник, для пачки пользователей (бейдж в списке анкет). */
export async function getVerifiedMap(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (userIds.length === 0) return out;
  const gameId = await eftGameId();

  const rows = await db
    .select({ userId: playerVerifications.userId, nickname: playerVerifications.claimedNickname })
    .from(playerVerifications)
    .where(
      and(
        eq(playerVerifications.gameId, gameId),
        eq(playerVerifications.status, "approved"),
        inArray(playerVerifications.userId, userIds),
      ),
    );

  for (const r of rows) out.set(r.userId, r.nickname);
  return out;
}

/** Последние подтверждённые (на будущее — витрина «проверенные бойцы»). */
export async function getRecentVerified(limit = 20): Promise<{ userId: string; nickname: string }[]> {
  const gameId = await eftGameId();
  const rows = await db
    .select({ userId: playerVerifications.userId, nickname: playerVerifications.claimedNickname })
    .from(playerVerifications)
    .where(and(eq(playerVerifications.gameId, gameId), eq(playerVerifications.status, "approved")))
    .orderBy(desc(playerVerifications.reviewedAt))
    .limit(Math.min(limit, 50));
  return rows.map((r) => ({ userId: r.userId, nickname: r.nickname }));
}
