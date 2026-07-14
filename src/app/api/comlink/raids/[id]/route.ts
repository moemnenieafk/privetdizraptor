// PATCH /api/comlink/raids/[id] — ответ на заявку либо отзыв.
//   { action: "accept" }  — подтвердить рейд (только приглашённый; +5 кармы обоим)
//   { action: "decline" } — отклонить
//   { action: "review", positive, comment? } — оценить подтверждённый рейд
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { resolveRaid, submitReview } from "@/db/comlink-raids";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: Ctx): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return err(422, "Некорректный id");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: { action?: unknown; positive?: unknown; comment?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const action = body.action;

  if (action === "accept" || action === "decline") {
    const result = await resolveRaid(id, me.id, action === "accept");
    return result.ok ? NextResponse.json({ ok: true }) : err(409, result.error ?? "Ошибка");
  }

  if (action === "review") {
    if (typeof body.positive !== "boolean") return err(422, "Нужна оценка: positive true/false");
    const comment = typeof body.comment === "string" ? body.comment : "";
    const result = await submitReview(id, me.id, body.positive, comment);
    return result.ok ? NextResponse.json({ ok: true }) : err(409, result.error ?? "Ошибка");
  }

  return err(422, "Неизвестное действие");
}
