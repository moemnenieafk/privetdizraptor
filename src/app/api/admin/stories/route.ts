// /api/admin/stories — CMS сюжетных гайдов (E10, фаза 5). Права: admin | editor.
//
//   POST — создать/обновить гайд (ключ — slug). Тело дерева пересобирается
//          санитайзером: клиентскому JSON не доверяем, он ложится в БД одним jsonb.
//
// После записи сбрасываем кэш страницы гайда — публикация видна сразу.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/auth/me";
import { canEditContent } from "@/lib/auth/roles";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { sanitizeStory } from "@/lib/story-sanitize";
import { upsertStory } from "@/db/stories";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canEditContent(me.role)) return err(403, "Только для редакторов ЦТА");

  // Гайд — большое дерево, но 512 КБ JSON с запасом хватает даже Борею.
  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой гайд");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "Некорректный JSON");
  }

  const published =
    typeof body === "object" && body !== null && (body as { published?: unknown }).published !== false;

  const result = sanitizeStory(body);
  if (!result.ok || !result.doc) return err(422, result.error ?? "Некорректный гайд");

  try {
    await upsertStory(me.id, result.doc, published);
  } catch (e) {
    console.error("[api/admin/stories]", e);
    return err(500, "Не удалось сохранить. Возможно, миграция историй ещё не накатана.");
  }

  revalidatePath(`/eft/quests/${result.doc.slug}`);
  revalidatePath("/eft/quests/lore-quests");
  return NextResponse.json({ ok: true, slug: result.doc.slug, published });
}
