// /api/admin/articles — CMS для Блога, Мастер-классов и разборов патчей.
// Только role=admin (модератор правит форум, но не публикует от имени ЦТА).
//
//   POST   — создать/обновить материал (id в теле = правка)
//   DELETE — удалить (?id=)
//
// Импортированный из Steam патч правится ЧАСТИЧНО: можно писать только bodyRu
// (наш разбор). Заголовок, выжимка и дата принадлежат первоисточнику — их не трогаем.
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { deleteArticle, upsertArticle, type UpsertArticleInput } from "@/db/articles";
import type { ArticleKind } from "@/db/schema-articles";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const KINDS = new Set<ArticleKind>(["patch", "news", "masterclass"]);
const UUID_RE = /^[0-9a-f-]{36}$/;
const MAX_TITLE = 160;
const MAX_BODY = 40_000;

/** Слаг из заголовка: кириллица транслитерируется, иначе URL станет %D0%BF… */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return s.length > 0 ? s : `post-${Date.now()}`;
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (me.role !== "admin") return err(403, "Только для админов ЦТА");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const kind = body.kind;
  if (typeof kind !== "string" || !KINDS.has(kind as ArticleKind)) {
    return err(422, "Неизвестный тип материала");
  }

  const id = typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : undefined;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const bodyRu = typeof body.bodyRu === "string" ? body.bodyRu.trim() : "";

  // Для нового материала заголовок обязателен; для правки патча — только разбор.
  const isPatchEdit = kind === "patch" && id !== undefined;

  if (!isPatchEdit) {
    if (title.length < 3) return err(422, "Заголовок — от 3 символов");
    if (title.length > MAX_TITLE) return err(422, `Заголовок — до ${MAX_TITLE} символов`);
  }
  if (bodyRu.length > MAX_BODY) return err(422, "Текст слишком длинный");

  const eventAtRaw = body.eventAt;
  const eventAt =
    typeof eventAtRaw === "string" && eventAtRaw.length > 0 ? new Date(eventAtRaw) : null;
  if (eventAt && Number.isNaN(eventAt.getTime())) return err(422, "Некорректная дата события");

  const input: UpsertArticleInput = {
    id,
    kind: kind as ArticleKind,
    title,
    slug: typeof body.slug === "string" && body.slug.length > 0 ? body.slug : slugify(title),
    excerpt: typeof body.excerpt === "string" ? body.excerpt.trim().slice(0, 400) : "",
    bodyRu,
    coverUrl: typeof body.coverUrl === "string" && body.coverUrl.length > 0 ? body.coverUrl : null,
    eventAt,
    videoUrl: typeof body.videoUrl === "string" && body.videoUrl.length > 0 ? body.videoUrl : null,
    published: body.published !== false,
  };

  const result = await upsertArticle(me.id, input);
  return result.ok
    ? NextResponse.json({ ok: true, id: result.id })
    : err(409, result.error ?? "Не удалось сохранить");
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (me.role !== "admin") return err(403, "Только для админов ЦТА");

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return err(422, "Некорректный id");

  await deleteArticle(id);
  return NextResponse.json({ ok: true });
}
