// /api/admin/codex — CMS Кодекса (E10, фаза 3). Права: admin | editor.
//
//   POST   — создать/обновить статью (ключ — slug)
//   DELETE — удалить (?slug=)
//
// Тело статьи (CodexArticle) приходит целиком и валидируется здесь: доверять
// клиентскому JSON нельзя, а в БД он ложится одним jsonb-полем.
// После записи сбрасываем кэш страницы — публикация видна сразу, без ребилда.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/auth/me";
import { canEditContent } from "@/lib/auth/roles";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { deleteCodex, upsertCodex } from "@/db/codex";
import type { CodexArticle, CodexSection, CodexTimelineEntry } from "@/types/codex";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const SLUG_RE = /^[a-z0-9-]{2,60}$/;
const MAX_TITLE = 160;
const MAX_TEXT = 8_000;
const MAX_SECTIONS = 40;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown, max = MAX_TEXT): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const strList = (v: unknown, max = MAX_SECTIONS): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim().slice(0, MAX_TEXT))
        .slice(0, max)
    : [];

function parseSections(v: unknown): CodexSection[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isObject)
    .map((s) => ({
      heading: str(s.heading, MAX_TITLE),
      body: strList(s.body),
      ...(strList(s.bullets).length > 0 ? { bullets: strList(s.bullets) } : {}),
    }))
    .filter((s) => s.heading.length > 0 || s.body.length > 0)
    .slice(0, MAX_SECTIONS);
}

function parseTimeline(v: unknown): CodexTimelineEntry[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const entries = v
    .filter(isObject)
    .map((e) => ({
      date: str(e.date, 80),
      title: str(e.title, MAX_TITLE),
      text: str(e.text),
    }))
    .filter((e) => e.date.length > 0 || e.title.length > 0)
    .slice(0, MAX_SECTIONS);
  return entries.length > 0 ? entries : undefined;
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

  const slug = str(body.slug, 60).toLowerCase();
  if (!SLUG_RE.test(slug)) return err(422, "Некорректный slug (a-z, 0-9, дефис)");

  const title = str(body.title, MAX_TITLE);
  if (!title) return err(422, "Заголовок обязателен");

  const sections = parseSections(body.sections);
  const intro = str(body.intro);
  if (!intro && sections.length === 0) return err(422, "Статья пустая");

  const doc: CodexArticle = {
    slug,
    title,
    intro,
    sections,
    ...(str(body.subtitle, MAX_TITLE) ? { subtitle: str(body.subtitle, MAX_TITLE) } : {}),
    ...(str(body.icon, 200) ? { icon: str(body.icon, 200) } : {}),
    ...(parseTimeline(body.timeline) ? { timeline: parseTimeline(body.timeline) } : {}),
    ...(strList(body.sources).length > 0 ? { sources: strList(body.sources) } : {}),
    ...(body.confidence === "canon" || body.confidence === "mixed"
      ? { confidence: body.confidence }
      : {}),
  };

  const published = body.published !== false;

  try {
    await upsertCodex(me.id, doc, published);
  } catch (e) {
    console.error("[api/admin/codex]", e);
    return err(500, "Не удалось сохранить. Возможно, миграция кодекса ещё не накатана.");
  }

  revalidatePath("/eft/gamesetting");
  revalidatePath(`/eft/gamesetting/${slug}`);
  return NextResponse.json({ ok: true, slug, published });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canEditContent(me.role)) return err(403, "Только для редакторов ЦТА");

  const slug = (new URL(req.url).searchParams.get("slug") ?? "").toLowerCase();
  if (!SLUG_RE.test(slug)) return err(422, "Некорректный slug");

  await deleteCodex(slug);
  revalidatePath("/eft/gamesetting");
  revalidatePath(`/eft/gamesetting/${slug}`);
  return NextResponse.json({ ok: true });
}
