// POST /api/feedback — приём обращения формы «Сообщить об ошибке» (Figma 1588:1322).
// multipart/form-data: email, message, pageUrl, files[] (скриншоты). Пишем в таблицу
// feedback серверной owner-ролью (мимо RLS). Отправка на почту отложена (hosting-vercel-first)
// — сперва копим в БД. userId берём из сессии Supabase, если залогинен (не из тела).
import { NextResponse } from "next/server";
import { db } from "@/db";
import { feedback, type FeedbackAttachment } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 500 * 1024; // 500 КБ на файл
const MAX_TOTAL_BYTES = MAX_FILES * MAX_FILE_BYTES + 256 * 1024; // + запас на текст
const MAX_MESSAGE = 5000;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp", "image/gif"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  // Ранний 413 по Content-Length — до буферизации тела.
  const len = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(len) && len > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad form" }, { status: 400 });
  }

  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  const pageUrl = String(form.get("pageUrl") ?? "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "bad email" }, { status: 422 });
  }
  if (!message || message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "bad message" }, { status: 422 });
  }
  if (!pageUrl) {
    return NextResponse.json({ error: "no page" }, { status: 422 });
  }

  // Вложения (скриншоты): ≤5 шт × ≤500 КБ, только изображения.
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: "too many files" }, { status: 422 });
  }
  const attachments: FeedbackAttachment[] = [];
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "bad file type" }, { status: 422 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "file too large" }, { status: 422 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    attachments.push({
      name: file.name.slice(0, 200),
      type: file.type,
      size: file.size,
      dataBase64: buf.toString("base64"),
    });
  }

  const userId = await currentUserId();
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  try {
    await db.insert(feedback).values({
      pageUrl: pageUrl.slice(0, 2000),
      email: email.slice(0, 320),
      message,
      attachments,
      userId,
      userAgent,
    });
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
