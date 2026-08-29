// /api/comlink/raids — заявки на совместный рейд.
//   GET  — мои рейды (входящие/исходящие/на оценку)
//   POST — позвать игрока: { partnerId, note? }. Rate-limit 5 заявок/час — анти-спам.
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { getMe } from "@/lib/auth/me";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { createRaid, getMyRaids } from "@/db/comlink-raids";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const INVITE_WINDOW_MS = 60 * 60 * 1000;
const INVITE_CAP = 5;

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  const raids = await getMyRaids(me.id);
  return NextResponse.json({ raids });
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: { partnerId?: unknown; note?: unknown };
  try {
    body = (await req.json()) as { partnerId?: unknown; note?: unknown };
  } catch {
    return err(400, "Некорректный запрос");
  }

  const partnerId = typeof body.partnerId === "string" ? body.partnerId : "";
  if (!/^[0-9a-f-]{36}$/.test(partnerId)) return err(422, "Некорректный id игрока");
  const note = typeof body.note === "string" ? body.note.trim() : "";

  // Rate-limit: 5 приглашений в час.
  const key = `comlink-invite:${me.id}`;
  const [rl] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  const now = Date.now();
  const inWindow = rl && now - rl.windowStart.getTime() < INVITE_WINDOW_MS;

  if (inWindow && rl.count >= INVITE_CAP) {
    return err(429, "Не больше 5 приглашений в час — дождитесь ответов");
  }

  const result = await createRaid(me.id, partnerId, note);
  if (!result.ok) return err(409, result.error ?? "Не удалось создать заявку");

  await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: inWindow
        ? { count: sql`${rateLimits.count} + 1` }
        : { count: 1, windowStart: sql`now()` },
    });

  return NextResponse.json({ ok: true, raidId: result.raidId });
}
