// POST /api/account/avatar — загрузка аватара текущего юзера (Фаза 2-идентичность).
// Клиент присылает готовый квадратный webp (canvas-кроп). Заливаем в бакет cta-media
// по ключу avatars/{uid}.webp.
//
// ⚠️ Заливка идёт SERVICE-ROLE клиентом (обход RLS) — ОСОЗНАННОЕ исключение из правила
// «service-key не в рантайме». Причина: в этом проекте data-plane Supabase не валидирует
// пользовательский JWT для storage-RLS (баг фичи JWT signing keys, см. auto-memory
// [[supabase-jwt-es256-dataplane]]). Безопасность держит САМ роут: сессия (getUser→401)
// + ключ ЖЁСТКО = avatars/{user.id}.webp (id из сессии, не из тела) — юзер не зальёт
// чужой аватар. Требует SUPABASE_SERVICE_ROLE_KEY в env рантайма (Vercel).
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { createClient as createAdminClient } from "@supabase/supabase-js";
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

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) return err(500, "Хранилище не настроено");

  // Service-role клиент: путь уже жёстко привязан к user.id (см. шапку файла).
  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: upErr } = await admin.storage
    .from("cta-media")
    .upload(key, buf, { contentType: "image/webp", upsert: true });
  if (upErr) return err(500, "Не удалось загрузить аватар");

  // ?v= — cache-busting: ключ один и тот же при перезаливке.
  const url = `${supabaseUrl}/storage/v1/object/public/cta-media/${key}?v=${Date.now()}`;

  await db
    .update(profiles)
    .set({ avatarUrl: url, updatedAt: sql`now()` })
    .where(eq(profiles.id, user.id));

  return NextResponse.json({ ok: true, url });
}
