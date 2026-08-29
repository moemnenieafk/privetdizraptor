// /api/comlink/reports — жалобы.
//   POST — пожаловаться { targetId, refType, refId, reason }. 5 жалоб/час.
//   GET  — очередь открытых (admin|moderator)
//   PATCH — разбор { reportId, status: upheld|rejected }. upheld → цели −25 кармы.
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { getMe } from "@/lib/auth/me";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { canModerate, createReport, getOpenReports, resolveReport } from "@/db/comlink-forum";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const UUID_RE = /^[0-9a-f-]{36}$/;
const REF_TYPES = new Set(["profile", "review", "topic", "post"]);
const WINDOW_MS = 60 * 60 * 1000;
const CAP = 5;

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canModerate(me.role)) return err(403, "Только для модераторов");

  const reports = await getOpenReports();
  return NextResponse.json({ reports });
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: { targetId?: unknown; refType?: unknown; refId?: unknown; reason?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const refType = typeof body.refType === "string" ? body.refType : "";
  const refId = typeof body.refId === "string" ? body.refId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!UUID_RE.test(targetId)) return err(422, "Некорректная цель");
  if (!REF_TYPES.has(refType)) return err(422, "Неизвестный тип объекта");
  if (refId.length === 0 || refId.length > 80) return err(422, "Некорректный объект");
  if (reason.length < 10) return err(422, "Опишите причину (от 10 символов)");
  if (targetId === me.id) return err(422, "На себя жаловаться не нужно");

  const key = `comlink-report:${me.id}`;
  const [rl] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  const now = Date.now();
  const inWindow = rl && now - rl.windowStart.getTime() < WINDOW_MS;

  if (inWindow && rl.count >= CAP) return err(429, "Не больше 5 жалоб в час");

  const result = await createReport(me.id, targetId, refType, refId, reason);
  if (!result.ok) return err(409, result.error ?? "Не удалось отправить жалобу");

  await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: inWindow ? { count: sql`${rateLimits.count} + 1` } : { count: 1, windowStart: sql`now()` },
    });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canModerate(me.role)) return err(403, "Только для модераторов");

  let body: { reportId?: unknown; status?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const reportId = typeof body.reportId === "string" ? body.reportId : "";
  if (!UUID_RE.test(reportId)) return err(422, "Некорректный id жалобы");
  if (body.status !== "upheld" && body.status !== "rejected") return err(422, "status: upheld | rejected");

  const result = await resolveReport(reportId, me.id, body.status);
  return result.ok ? NextResponse.json({ ok: true }) : err(409, result.error ?? "Ошибка");
}
