// /api/comlink/topics — форум «Обсуждения».
//   GET  — список тем (авторизованным)
//   POST — новая тема { title, body }. Rate-limit 3 темы/час.
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { getMe } from "@/lib/auth/me";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { createTopic, getTopics } from "@/db/comlink-forum";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const WINDOW_MS = 60 * 60 * 1000;
const CAP = 3;
const MAX_TITLE = 120;
const MAX_BODY = 4000;

export async function GET(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  const url = new URL(req.url);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const data = await getTopics(30, offset);
  return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=15" } });
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: { title?: unknown; body?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (title.length < 5) return err(422, "Заголовок — от 5 символов");
  if (title.length > MAX_TITLE) return err(422, `Заголовок — до ${MAX_TITLE} символов`);
  if (text.length < 10) return err(422, "Текст темы — от 10 символов");
  if (text.length > MAX_BODY) return err(422, `Текст — до ${MAX_BODY} символов`);

  const key = `comlink-topic:${me.id}`;
  const [rl] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  const now = Date.now();
  const inWindow = rl && now - rl.windowStart.getTime() < WINDOW_MS;

  if (inWindow && rl.count >= CAP) return err(429, "Не больше 3 тем в час");

  const result = await createTopic(me.id, title, text);
  if (!result.ok) return err(500, result.error ?? "Не удалось создать тему");

  await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: inWindow ? { count: sql`${rateLimits.count} + 1` } : { count: 1, windowStart: sql`now()` },
    });

  return NextResponse.json({ ok: true, topicId: result.topicId });
}
