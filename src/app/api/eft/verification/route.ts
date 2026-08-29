// /api/eft/verification — подтверждение ЧВК-профиля («галочка»).
//   GET   — моя верификация + право на неё (тир).
//   POST  — { action: 'start' } выдать код | { action: 'submit', proof, accountRef } скрин.
//           Только платные тиры (operative+). Rate-limit на нашей БД.
//   PATCH — разбор { targetUserId, decision: approved|rejected, note } (admin|moderator).
//
// Пользователь берётся ТОЛЬКО из сессии (никогда из тела). Скрин-пруф идёт инлайном
// base64 — тело крупнее обычного JSON-кап, поэтому свой MAX_BODY.
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { canModerate } from "@/lib/auth/roles";
import { getSubscription } from "@/lib/subscription.server";
import { tierMeets, TIERS } from "@/data/subscription-tiers";
import { rateLimit } from "@/lib/rate-limit";
import { bodyTooLarge } from "@/lib/http";
import { revalidateProfileByUserId } from "@/lib/revalidate-profile";
import {
  getMyVerification,
  startVerification,
  submitVerification,
  reviewVerification,
} from "@/db/verification";
import type { VerificationProof } from "@/db/schema-comlink";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

// Верификация — платная фича (решение V4DYA). Минимальный тир — «Оперативник».
const MIN_TIER = "operative" as const;

// Тело со скрином base64: ~1.6 МБ картинки → ~2.2 МБ base64 + обвязка.
const MAX_BODY = 3 * 1024 * 1024;
const MAX_B64 = 2_400_000; // ≈ 1.75 МБ декодированного изображения
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const UUID_RE = /^[0-9a-f-]{36}$/;

// Сигнатура реального изображения (magic-byte) — не доверяем клиентскому mime.
function magicMatches(base64: string, mime: string): boolean {
  const head = Buffer.from(base64.slice(0, 16), "base64");
  if (head.length < 12) return false;
  if (mime === "image/png")
    return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  if (mime === "image/jpeg") return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (mime === "image/webp")
    return head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP";
  return false;
}

/** Валидирует и нормализует пруф из тела. null — невалиден. */
function parseProof(v: unknown): VerificationProof | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const mime = typeof o.mime === "string" ? o.mime : "";
  const dataBase64 = typeof o.dataBase64 === "string" ? o.dataBase64 : "";
  if (!ALLOWED_MIME.has(mime)) return null;
  if (dataBase64.length === 0 || dataBase64.length > MAX_B64) return null;
  if (!magicMatches(dataBase64, mime)) return null;
  const size = Math.floor((dataBase64.length * 3) / 4);
  return { mime, size, dataBase64 };
}

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  const sub = await getSubscription(me.id);
  const eligible = tierMeets(sub.tier, MIN_TIER);
  const verification = await getMyVerification(me.id);

  return NextResponse.json({
    eligible,
    tier: sub.tier,
    minTierName: TIERS[MIN_TIER].name,
    verification,
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  if (bodyTooLarge(req, MAX_BODY)) return err(413, "Слишком большой запрос");

  const sub = await getSubscription(me.id);
  if (!tierMeets(sub.tier, MIN_TIER)) {
    return err(403, `Верификация доступна с тира «${TIERS[MIN_TIER].name}»`);
  }

  let body: { action?: unknown; proof?: unknown; accountRef?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  if (body.action === "start") {
    const allowed = await rateLimit(`verif-start:${me.id}`, 10, 86_400);
    if (!allowed) return err(429, "Слишком много запросов кода. Попробуйте завтра");

    const res = await startVerification(me.id);
    if (!res.ok) return err(409, res.error ?? "Не удалось выдать код");
    return NextResponse.json({ ok: true, code: res.code, claimedNickname: res.claimedNickname });
  }

  if (body.action === "submit") {
    const proof = parseProof(body.proof);
    if (!proof) return err(422, "Нужен скриншот (PNG/JPEG/WEBP, до ~1.7 МБ)");

    const accountRef =
      typeof body.accountRef === "string" && body.accountRef.trim().length > 0
        ? body.accountRef.trim().slice(0, 200)
        : null;

    const allowed = await rateLimit(`verif-submit:${me.id}`, 6, 86_400);
    if (!allowed) return err(429, "Слишком много заявок. Попробуйте завтра");

    const res = await submitVerification(me.id, proof, accountRef);
    if (!res.ok) return err(409, res.error ?? "Не удалось отправить заявку");
    return NextResponse.json({ ok: true });
  }

  return err(422, "Неизвестное действие");
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canModerate(me.role)) return err(403, "Только для модераторов");

  let body: { targetUserId?: unknown; decision?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
  if (!UUID_RE.test(targetUserId)) return err(422, "Некорректный пользователь");
  if (body.decision !== "approved" && body.decision !== "rejected") {
    return err(422, "decision: approved | rejected");
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (body.decision === "rejected" && note.length < 3) {
    return err(422, "Укажите причину отклонения");
  }

  const res = await reviewVerification(me.id, targetUserId, body.decision, note);
  if (res.ok) {
    // Галочка видна на публичном профиле — обновляем сразу, не ждём ISR.
    await revalidateProfileByUserId(targetUserId);
    return NextResponse.json({ ok: true });
  }
  return err(409, res.error ?? "Ошибка");
}
