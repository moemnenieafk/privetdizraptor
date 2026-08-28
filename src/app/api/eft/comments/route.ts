// /api/eft/comments — обсуждение под любой сущностью портала.
//   GET    ?type=&id=&sort=best|new → { items, me }
//   POST   { type, id, body }       → создать (ТОЛЬКО платный тир + модераторы)
//   DELETE ?id=<commentId>          → мягко удалить свой
//   PATCH  { id, hidden }           → скрыть/вернуть (модератор)
//
// Цель адресуется парой type+id (реестр — src/lib/comment-targets.ts). FK на цель
// нет, поэтому её существование проверяется до вставки (comment-targets.server.ts).
// Гейт по тиру серверный намеренно: <Paywall> в UI — это UX, а не защита.
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { canModerate } from "@/lib/auth/roles";
import { getSubscription } from "@/lib/subscription.server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { isCommentTargetType, isValidTargetId, type CommentTargetType } from "@/lib/comment-targets";
import { targetExists } from "@/lib/comment-targets.server";
import {
  createComment,
  deleteOwnComment,
  editOwnComment,
  getEntityComments,
  hideComment,
  type CommentSort,
} from "@/db/entity-comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * Право писать: платный тир ИЛИ модератор/админ (им нужно отвечать в ветке).
 * Исключение — сборки перков (`season-build`): их обсуждение открыто ЛЮБОМУ
 * залогиненному (решение V4DYA 2026-08-28) — сознательный рассинхрон с остальным
 * порталом ради вовлечения вокруг шаринга сборок.
 */
async function canWriteComments(
  userId: string,
  role: string,
  type: CommentTargetType,
): Promise<boolean> {
  if (canModerate(role)) return true;
  if (type === "season-build") return true;
  const sub = await getSubscription(userId);
  return sub.tier !== "free";
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  if (!isCommentTargetType(type) || !isValidTargetId(id)) return err(422, "Некорректная цель");

  const sort: CommentSort = url.searchParams.get("sort") === "new" ? "new" : "best";

  const me = await getMe();
  const moderator = me ? canModerate(me.role) : false;

  const items = await getEntityComments(
    { type, id },
    { sort, viewerId: me?.id ?? null, viewerCanModerate: moderator },
  );

  const meInfo = me
    ? {
        userId: me.id,
        canVote: true,
        canModerate: moderator,
        canWrite: await canWriteComments(me.id, me.role, type),
      }
    : null;

  return NextResponse.json({ items, me: meInfo });
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Войдите, чтобы комментировать");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: { type?: unknown; id?: unknown; body?: unknown; parentId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const { type, id } = body;
  if (!isCommentTargetType(type) || !isValidTargetId(id)) return err(422, "Некорректная цель");
  const text = typeof body.body === "string" ? body.body : "";
  const parentId = typeof body.parentId === "string" && UUID_RE.test(body.parentId) ? body.parentId : null;

  if (!(await canWriteComments(me.id, me.role, type))) {
    return err(403, "Комментарии доступны с подпиской «Оперативник» и выше");
  }

  if (!(await rateLimit(`comment:${me.id}`, 30, 3600))) {
    return err(429, "Слишком много сообщений. Передохни");
  }

  if (!(await targetExists(type, id))) return err(404, "Страница не найдена");

  const res = await createComment({ type, id }, me.id, text, parentId);
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

  let body: { id?: unknown; hidden?: unknown; body?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id)) return err(422, "Некорректный id");

  // Правка своего текста (автор) — если пришло поле body. Скрытие/возврат (модератор) —
  // если пришло hidden. Разводим по payload: у правки и модерации разные права.
  if (typeof body.body === "string") {
    if (!(await rateLimit(`comment-edit:${me.id}`, 60, 3600))) {
      return err(429, "Слишком часто. Передохни");
    }
    const res = await editOwnComment(id, me.id, body.body);
    if (!res.ok) return err(422, res.error ?? "Не удалось сохранить правку");
    return NextResponse.json({ ok: true });
  }

  if (!canModerate(me.role)) return err(403, "Недостаточно прав");
  const hidden = body.hidden !== false;

  const ok = await hideComment(id, me.id, hidden);
  if (!ok) return err(404, "Комментарий не найден");
  return NextResponse.json({ ok: true, hidden });
}
