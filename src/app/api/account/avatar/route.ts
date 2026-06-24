// POST /api/account/avatar — загрузка аватара текущего юзера (Фаза 2-идентичность).
// Клиент присылает готовый квадратный webp (canvas-кроп). Заливаем СЕССИОННЫМ
// клиентом в бакет cta-media по ключу avatars/{uid}.webp — RLS по auth.uid()
// (см. supabase/account-identity.sql). Service-key в рантайме НЕ инстанцируем.
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 500 * 1024; // 500 КБ

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err(401, "Не авторизован");

  // Ранний отсев по Content-Length — не буферизуем гигантское тело ради 500КБ-гейта.
  const declaredLen = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLen) && declaredLen > MAX_BYTES + 4096) {
    return err(413, "Изображение не более 500 КБ");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err(400, "Некорректный запрос");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return err(422, "Файл не передан");
  if (file.type !== "image/webp") return err(422, "Ожидается изображение webp");
  if (file.size === 0) return err(422, "Пустой файл");
  if (file.size > MAX_BYTES) return err(422, "Изображение не более 500 КБ");

  const key = `avatars/${user.id}.webp`;
  const buf = Buffer.from(await file.arrayBuffer());

  // Сигнатура WEBP (RIFF....WEBP) — не доверяем клиентскому MIME, проверяем байты.
  const isWebp =
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP";
  if (!isWebp) return err(422, "Файл не является корректным webp");

  const { error: upErr } = await supabase.storage
    .from("cta-media")
    .upload(key, buf, { contentType: "image/webp", upsert: true });
  if (upErr) return err(500, "Не удалось загрузить аватар");

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // ?v= — cache-busting: ключ один и тот же при перезаливке.
  const url = `${base}/storage/v1/object/public/cta-media/${key}?v=${Date.now()}`;

  await db
    .update(profiles)
    .set({ avatarUrl: url, updatedAt: sql`now()` })
    .where(eq(profiles.id, user.id));

  return NextResponse.json({ ok: true, url });
}
