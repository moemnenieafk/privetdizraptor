// /api/room-opens — ПУБЛИЧНАЯ подача открытия меченой комнаты на модерацию (любой авторизованный).
//   POST { roomId, itemIds[], proofYoutubeUrl, gameVersion? } → status='pending', authorId=me.
// На слово не верим — обязателен пруф-ссылка на YouTube. Скрин-бакет — трекер v2.1.
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { submitRoomOpen } from "@/db/marked-rooms";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YT_RE = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Войдите, чтобы добавить открытие");
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
  if (itemIds.length === 0) return err(422, "Отметь хотя бы один предмет");
  const proof = typeof body.proofYoutubeUrl === "string" ? body.proofYoutubeUrl.trim().slice(0, 300) : "";
  if (!YT_RE.test(proof)) return err(422, "Нужна ссылка на YouTube (пруф)");
  const gameVersion = typeof body.gameVersion === "string" ? body.gameVersion.trim().slice(0, 40) || null : null;

  try {
    const id = await submitRoomOpen(roomId, itemIds, me.id, { proofYoutubeUrl: proof, gameVersion });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[api/room-opens]", e);
    return err(500, "Не удалось отправить открытие");
  }
}
