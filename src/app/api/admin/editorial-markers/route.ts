// /api/admin/editorial-markers — CMS ручных маркеров карт (админ/модератор).
//   GET    ?mapId=   — список маркеров карты (для панели редактора)
//   POST             — создать/обновить маркер (id в теле = правка)
//   DELETE ?id=      — удалить
// Права: admin | editor (canEditContent). gameId и authorId ставит сервер, не клиент.
// Схема/решения: docs/decisions/editorial-markers-tool.md.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/auth/me";
import { canEditContent } from "@/lib/auth/roles";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { eftGameId } from "@/db/eft";
import { getEditorialMarkers, upsertEditorialMarker, deleteEditorialMarker } from "@/db/editorial-markers";
import type { EditorialLinkKind, NewEditorialMarker } from "@/db/schema-editorial";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const SLUG_RE = /^[a-z0-9-]{2,60}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE = 160;
const MAX_DESC = 4_000;
const MAX_KEY = 300;
const MAX_SHOTS = 12;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const intOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);
const shots = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, MAX_KEY)).slice(0, MAX_SHOTS)
    : [];
const linkKind = (v: unknown): EditorialLinkKind => (v === "story" || v === "quest" || v === "event" ? v : "none");

export async function GET(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canEditContent(me.role)) return err(403, "Только для редакторов ЦТА");

  const mapId = new URL(req.url).searchParams.get("mapId") ?? "";
  if (!mapId) return err(422, "Нужен mapId");
  return NextResponse.json({ markers: await getEditorialMarkers(mapId) });
}

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

  const mapId = str(body.mapId, 120);
  if (!mapId) return err(422, "mapId обязателен");
  const title = str(body.title, MAX_TITLE);
  if (!title) return err(422, "Название обязательно");
  const x = num(body.x);
  const z = num(body.z);
  if (x === null || z === null) return err(422, "Нужны координаты x и z");

  const kind = linkKind(body.linkKind);
  const gameId = await eftGameId();

  const row: NewEditorialMarker = {
    ...(typeof body.id === "string" && UUID_RE.test(body.id) ? { id: body.id } : {}),
    gameId,
    mapId,
    floor: intOrNull(body.floor),
    x,
    y: num(body.y),
    z,
    type: str(body.type, 40) || "poi",
    category: str(body.category, 60) || null,
    faction: str(body.faction, 40) || null,
    title,
    description: str(body.description, MAX_DESC) || null,
    screenshots: shots(body.screenshots),
    linkKind: kind,
    linkId: kind === "none" ? null : str(body.linkId, 80) || null,
    linkStep: intOrNull(body.linkStep),
    authorId: me.id,
  };

  let saved;
  try {
    saved = await upsertEditorialMarker(row);
  } catch (e) {
    console.error("[api/admin/editorial-markers]", e);
    return err(500, "Не удалось сохранить (миграция накатана?)");
  }

  const slug = str(body.slug, 60).toLowerCase();
  if (SLUG_RE.test(slug)) revalidatePath(`/eft/maps/${slug}`);
  return NextResponse.json({ ok: true, marker: saved });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canEditContent(me.role)) return err(403, "Только для редакторов ЦТА");

  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return err(422, "Некорректный id");

  await deleteEditorialMarker(id);
  const slug = (url.searchParams.get("slug") ?? "").toLowerCase();
  if (SLUG_RE.test(slug)) revalidatePath(`/eft/maps/${slug}`);
  return NextResponse.json({ ok: true });
}
