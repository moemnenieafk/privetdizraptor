// /api/admin/room-opens — добавить ПОДТВЕРЖДЁННОЕ открытие меченой комнаты (админ/модератор).
//   POST { roomId, itemIds[], mapSlug?, roomSlug? } — создаёт approved-открытие + предметы, +ревалидация.
// Права: admin | editor (canEditContent). moderatorId ставит сервер. Решение: docs/decisions/marked-rooms.md.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/auth/me";
import { canEditContent } from "@/lib/auth/roles";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { addRoomOpen } from "@/db/marked-rooms";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9-]{2,60}$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canEditContent(me.role)) return err(403, "Только для редакторов ЦТА");
  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "Некорректный JSON");
  }
  if (!isObject(body)) return err(400, "Ожидался объект");

  const roomId = typeof body.roomId === "string" ? body.roomId : "";
  if (!UUID_RE.test(roomId)) return err(422, "Некорректный roomId");
  const itemIds = Array.isArray(body.itemIds)
    ? body.itemIds.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 40).slice(0, 50)
    : [];
  if (itemIds.length === 0) return err(422, "Нужен хотя бы один предмет");

  let openId: string;
  try {
    openId = await addRoomOpen(roomId, itemIds, me.id);
  } catch (e) {
    console.error("[api/admin/room-opens]", e);
    return err(500, "Не удалось сохранить открытие");
  }

  const mapSlug = typeof body.mapSlug === "string" ? body.mapSlug.toLowerCase() : "";
  const roomSlug = typeof body.roomSlug === "string" ? body.roomSlug.toLowerCase() : "";
  if (SLUG_RE.test(mapSlug) && SLUG_RE.test(roomSlug)) revalidatePath(`/eft/maps/${mapSlug}/rooms/${roomSlug}`);
  return NextResponse.json({ ok: true, openId });
}
