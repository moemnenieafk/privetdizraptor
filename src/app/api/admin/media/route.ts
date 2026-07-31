// /api/admin/media — медиа-библиотека CMS. Права: admin | editor.
//
//   GET    — каталог (последние загрузки)
//   POST   — загрузить файл (multipart: file, alt) → КОНВЕРТ В WEBP → Cloudflare R2
//   DELETE — удалить (?id=) из каталога и из бакета (R2 или legacy Supabase Storage)
//
// Хранилище — Cloudflare R2 (общий бакет с иконками/картами, zero-egress). Конвертация в webp
// делается СЕРВЕРНО через `sharp` (тот же libwebp, что cwebp.exe из C:\cta-converter, но
// кроссплатформенно — на Vercel Linux .exe не запустить). Клиент присылает уже сжатый webp
// (Canvas) ради лимита тела Vercel ~4.5 МБ; сервер всё равно пере-кодирует для единого качества.
// Ключ объекта генерим МЫ (сессия+роль+свой ключ → чужое не перезаписать). Секреты — только в env.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getMe } from "@/lib/auth/me";
import { canEditContent } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limit";
import { addMedia, listMedia, removeMedia } from "@/db/media";
import { r2Configured, r2Put, r2Delete } from "@/lib/r2";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const MAX_BYTES = 4 * 1024 * 1024; // 4 МБ вход (под лимит тела Vercel ~4.5 МБ; клиент шлёт уже webp)
const MAX_DIM = 2560; // кап по большей стороне (статичные изображения)
const WEBP_QUALITY = 90; // как в C:\cta-converter (config.json → webp_quality)
const UUID_RE = /^[0-9a-f-]{36}$/;

/** Принимаемые ВХОДНЫЕ форматы (на выходе всегда webp). */
const INPUT_MIME = new Set(["image/webp", "image/png", "image/jpeg", "image/gif"]);

/** Клиентскому MIME не верим — сверяем сигнатуру файла. */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

/** Service-role Supabase — только для удаления legacy-медиа, залитых в Storage до перехода на R2. */
function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) return null;
  return createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canEditContent(me.role)) return err(403, "Только для редакторов ЦТА");

  return NextResponse.json({ items: await listMedia() });
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canEditContent(me.role)) return err(403, "Только для редакторов ЦТА");

  if (!(await rateLimit(`media:uid:${me.id}`, 60, 3600))) {
    return err(429, "Слишком много загрузок. Попробуйте позже.");
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BYTES + 8192) {
    return err(413, "Файл не более 4 МБ (крупные скрины ужимаются в webp на клиенте)");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err(400, "Некорректный запрос");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return err(422, "Файл не передан");
  if (file.size > MAX_BYTES) return err(422, "Файл не более 4 МБ");

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime || !INPUT_MIME.has(mime)) return err(422, "Только изображения: webp, png, jpg, gif");

  if (!r2Configured()) return err(500, "Хранилище R2 не настроено (R2_* / публичный URL)");

  // Конвертация в webp (sharp = libwebp). Анимированный gif → анимированный webp (без ресайза,
  // чтобы не ломать кадры); статичные — ресайз до MAX_DIM по большей стороне.
  let webp: Buffer;
  try {
    const isGif = mime === "image/gif";
    let pipeline = sharp(buf, isGif ? { animated: true } : {});
    if (!isGif) pipeline = pipeline.resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true });
    webp = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
  } catch (e) {
    console.error("[api/admin/media] webp", e);
    return err(422, "Не удалось обработать изображение");
  }

  // Ключ генерим мы: клиент не может ни перезаписать чужой файл, ни выйти из префикса.
  const year = new Date().getFullYear();
  const path = `content/${year}/${randomUUID()}.webp`;

  let url: string;
  try {
    url = await r2Put(path, webp, "image/webp");
  } catch (e) {
    console.error("[api/admin/media] r2 put", e);
    return err(500, "Не удалось загрузить файл в R2");
  }

  const alt = String(form.get("alt") ?? "").trim().slice(0, 200);
  try {
    const item = await addMedia({ path, url, mime: "image/webp", bytes: webp.length, alt, uploadedBy: me.id });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    // Каталога нет (миграция не накатана) — объект уже в R2, откатываем, чтобы не осиротел.
    await r2Delete(path).catch(() => {});
    console.error("[api/admin/media] catalog", e);
    return err(500, "Каталог медиа недоступен. Прогоните миграцию migrate-media.");
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canEditContent(me.role)) return err(403, "Только для редакторов ЦТА");

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return err(422, "Некорректный id");

  const removed = await removeMedia(id);
  if (!removed) return err(404, "Файл не найден");

  // Где лежит объект — по url: legacy Supabase Storage vs наш R2.
  if (removed.url.includes("/storage/v1/object/public/")) {
    const sb = supabaseAdmin();
    if (sb) await sb.storage.from("cta-media").remove([removed.path]);
  } else {
    await r2Delete(removed.path).catch((e) => console.error("[api/admin/media] r2 del", e));
  }

  return NextResponse.json({ ok: true });
}
