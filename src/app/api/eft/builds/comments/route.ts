// /api/eft/builds/comments — ветка под опубликованной сборкой.
//   GET    ?slug=&sort=best|new → { items, me: { canWrite, canVote, canModerate, userId } }
//   POST   { slug, body }       → создать (ТОЛЬКО платный тир + модераторы)
//   DELETE ?id=                 → мягко удалить свой
//   PATCH  { id, hidden }       → скрыть/вернуть (модератор)
//
// Гейт по тиру серверный и намеренно продублирован здесь: <Paywall> в UI — это UX,
// а не защита (см. разведку по пэйволу — клиентские гейты обходятся прямым запросом).
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { canModerate } from "@/lib/auth/roles";
import { getSubscription } from "@/lib/subscription.server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildIdBySlug,
  createComment,
  deleteOwnComment,
  getBuildComments,
  hideComment,
  type CommentSort,
} from "@/db/build-comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const SLUG_RE = /^[a-z0-9]{6,16}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Право писать: платный тир ИЛИ модератор/админ (им нужно отвечать в ветке). */
async function canWriteComments(userId: string, role: string): Promise<boolean> {
  if (canModerate(role)) return true;
  const sub = await getSubscription(userId);
  return sub.tier !== "free";
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  if (!SLUG_RE.test(slug)) return err(422, "Некорректный slug");
  const sort: CommentSort = url.searchParams.get("sort") === "new" ? "new" : "best";

  const buildId = await buildIdBySlug(slug);
  if (!buildId) return NextResponse.json({ items: [], me: null });

  const me = await getMe();
  const moderator = me ? canModerate(me.role) : false;

  const items = await getBuildComments(buildId, {
    sort,
    viewerId: me?.id ?? null,
    viewerCanModerate: moderator,
  });

  const meInfo = me
    ? {
        userId: me.id,
        canVote: true,
        canModerate: moderator,
        canWrite: await canWriteComments(me.id, me.role),
      }
    : null;

  return NextResponse.json({ items, me: meInfo });
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Войдите, чтобы комментировать");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: { slug?: unknown; body?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";
  if (!SLUG_RE.test(slug)) return err(422, "Некорректный slug");

  if (!(await canWriteComments(me.id, me.role))) {
    return err(403, "Комментарии доступны с подпиской «Оперативник» и выше");
  }

  if (!(await rateLimit(`build-comment:${me.id}`, 30, 3600))) {
    return err(429, "Слишком много сообщений. Передохни");
  }

  const buildId = await buildIdBySlug(slug);
  if (!buildId) return err(404, "Сборка не найдена");

  const res = await createComment(buildId, me.id, text);
  if (!res.ok) return err(422, res.error ?? "Не удалось отправить");

  return NextResponse.json({ ok: true, id: res.id });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  const id = (new URL(req.url).searchParams.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) return err(422, "Некорректный id");

  const ok = await deleteOwnComment(id, me.id);
  if (!ok) return err(404, "Комментарий не найден");
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canModerate(me.role)) return err(403, "Недостаточно прав");

  let body: { id?: unknown; hidden?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id)) return err(422, "Некорректный id");
  const hidden = body.hidden !== false;

  const ok = await hideComment(id, me.id, hidden);
  if (!ok) return err(404, "Комментарий не найден");
  return NextResponse.json({ ok: true, hidden });
}
