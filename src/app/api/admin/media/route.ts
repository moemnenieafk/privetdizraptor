// /api/admin/media — медиа-библиотека CMS (E10, фаза 4). Права: admin | editor.
//
//   GET    — каталог (последние загрузки)
//   POST   — загрузить файл (multipart: file, alt)
//   DELETE — удалить (?id=) из бакета и каталога
//
// Заливка идёт SERVICE-ROLE клиентом — то же осознанное исключение, что в
// /api/account/avatar (data-plane Supabase не валидирует наш JWT для storage-RLS).
// Безопасность держит роут: сессия + роль + ключ объекта генерим МЫ (не клиент),
// поэтому чужое перезаписать нельзя.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getMe } from "@/lib/auth/me";
import { canEditContent } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limit";
import { addMedia, listMedia, removeMedia } from "@/db/media";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const MAX_BYTES = 3 * 1024 * 1024; // 3 МБ — скриншот игры в webp/png укладывается с запасом
const UUID_RE = /^[0-9a-f-]{36}$/;

/** MIME → расширение. Всё, чего нет в таблице, не принимаем. */
const TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
};

/** Клиентскому MIME не верим — сверяем сигнатуру файла. */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

function admin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) return null;
  return {
    client: createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    supabaseUrl,
  };
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
    return err(413, "Файл не более 3 МБ");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err(400, "Некорректный запрос");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return err(422, "Файл не передан");
  if (file.size > MAX_BYTES) return err(422, "Файл не более 3 МБ");

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime || !TYPES[mime]) return err(422, "Только изображения: webp, png, jpg, gif");

  const store = admin();
  if (!store) return err(500, "Хранилище не настроено");

  // Ключ генерим мы: клиент не может ни перезаписать чужой файл, ни выйти из префикса.
  const year = new Date().getFullYear();
  const path = `content/${year}/${randomUUID()}.${TYPES[mime]}`;

  const { error: upErr } = await store.client.storage
    .from("cta-media")
    .upload(path, buf, { contentType: mime, upsert: false });
  if (upErr) {
    console.error("[api/admin/media] upload", upErr);
    return err(500, "Не удалось загрузить файл");
  }

  const url = `${store.supabaseUrl}/storage/v1/object/public/cta-media/${path}`;
  const alt = String(form.get("alt") ?? "").trim().slice(0, 200);

  try {
    const item = await addMedia({ path, url, mime, bytes: buf.length, alt, uploadedBy: me.id });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    // Каталога нет (миграция не накатана) — файл уже в бакете, откатываем, чтобы не осиротел.
    await store.client.storage.from("cta-media").remove([path]);
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

  const path = await removeMedia(id);
  if (!path) return err(404, "Файл не найден");

  const store = admin();
  if (store) await store.client.storage.from("cta-media").remove([path]);

  return NextResponse.json({ ok: true });
}
