// /api/comlink/topics/[id] — одна тема.
//   GET   — тема + ответы
//   POST  — ответ { body }. Rate-limit 10 ответов/час.
//   PATCH — модерация { action: pin|lock|hide_post, value, postId? } (admin|moderator)
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { getMe } from "@/lib/auth/me";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { canModerate, createPost, getTopic, moderate } from "@/db/comlink-forum";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const UUID_RE = /^[0-9a-f-]{36}$/;
const WINDOW_MS = 60 * 60 * 1000;
const CAP = 10;
const MAX_BODY = 2000;

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return err(422, "Некорректный id");

  const topic = await getTopic(id);
  if (!topic) return err(404, "Тема не найдена");

  return NextResponse.json({ topic, canModerate: canModerate(me.role) });
}

export async function POST(req: Request, ctx: Ctx): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return err(422, "Некорректный id");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: { body?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 2) return err(422, "Ответ пустой");
  if (text.length > MAX_BODY) return err(422, `Ответ — до ${MAX_BODY} символов`);

  const key = `comlink-post:${me.id}`;
  const [rl] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  const now = Date.now();
  const inWindow = rl && now - rl.windowStart.getTime() < WINDOW_MS;

  if (inWindow && rl.count >= CAP) return err(429, "Не больше 10 ответов в час");

  const result = await createPost(id, me.id, text);
  if (!result.ok) return err(409, result.error ?? "Не удалось ответить");

  await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: inWindow ? { count: sql`${rateLimits.count} + 1` } : { count: 1, windowStart: sql`now()` },
    });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, ctx: Ctx): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canModerate(me.role)) return err(403, "Только для модераторов");

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return err(422, "Некорректный id");

  let body: { action?: unknown; value?: unknown; postId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const value = body.value === true;

  if (body.action === "pin") {
    await moderate({ type: "pin", topicId: id, value });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "lock") {
    await moderate({ type: "lock", topicId: id, value });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "hide_post") {
    const postId = typeof body.postId === "string" ? body.postId : "";
    if (!UUID_RE.test(postId)) return err(422, "Некорректный id поста");
    await moderate({ type: "hide_post", postId, value });
    return NextResponse.json({ ok: true });
  }

  return err(422, "Неизвестное действие");
}
