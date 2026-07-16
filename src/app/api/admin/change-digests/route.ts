// /api/admin/change-digests — сохранение редакторского разбора среза изменений.
// Права: admin | editor (canEditContent) — паттерн /api/admin/articles.
// POST { date: 'YYYY-MM-DD', noteRu, published } — upsert по дню.
// После записи сбрасываем кэш ленты обновлений (revalidatePath).
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/auth/me";
import { canEditContent } from "@/lib/auth/roles";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { upsertChangeDigest } from "@/db/game-changes";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE = 20_000;

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canEditContent(me.role)) return err(403, "Только для редакторов ЦТА");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const date = typeof body.date === "string" ? body.date : "";
  if (!DATE_RE.test(date)) return err(422, "Некорректная дата среза");

  const noteRu = typeof body.noteRu === "string" ? body.noteRu.trim() : "";
  if (noteRu.length > MAX_NOTE) return err(422, "Текст слишком длинный");

  const published = body.published === true;

  try {
    await upsertChangeDigest(me.id, date, noteRu, published);
  } catch (e) {
    console.error("[admin/change-digests]", e);
    return err(500, "Не удалось сохранить");
  }

  revalidatePath("/eft/gamesetting/game-updates");
  return NextResponse.json({ ok: true });
}
