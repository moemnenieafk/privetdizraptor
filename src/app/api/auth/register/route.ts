// POST /api/auth/register — регистрация: e-mail + логин (username) + пароль.
// Логин валидируется (формат + уникальность) и прокидывается в user_metadata
// (user_name) — наш триггер handle_new_user сидит его в profiles. signUp на
// серверном клиенте: при «Confirm email» ВКЛ сессии нет (нужно письмо-подтверждение),
// при ВЫКЛ — сессия сразу (cookie проставится в ответ).
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_-]{3,15}$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request): Promise<NextResponse> {
  // 3 коротких поля — тело крошечное; режем переразмерный payload до парсинга.
  const len = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(len) && len > 4096) return err(413, "Слишком большой запрос");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const email = isObject(body) && typeof body.email === "string" ? body.email.trim() : "";
  const username = isObject(body) && typeof body.username === "string" ? body.username.trim() : "";
  const password = isObject(body) && typeof body.password === "string" ? body.password : "";

  if (!EMAIL_RE.test(email) || email.length > 254) return err(422, "Введите корректный e-mail");
  if (!USERNAME_RE.test(username)) return err(422, "Логин: 3–15 символов, латиница, цифры, _ и -");
  if (password.length < 8 || password.length > 128) return err(422, "Пароль: 8–128 символов");

  // Уникальность логина без учёта регистра (профиль создаёт триггер; индекс — гарант).
  const [taken] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = lower(${username})`)
    .limit(1);
  if (taken) return err(409, "Этот логин уже занят");

  const origin = new URL(req.url).origin;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { user_name: username },
      emailRedirectTo: `${origin}/auth/confirm?next=/account`,
    },
  });
  if (error) {
    if (/already registered|already exists|registered/i.test(error.message)) {
      return err(409, "Этот e-mail уже зарегистрирован — войдите");
    }
    return err(400, "Не удалось зарегистрироваться. Попробуйте позже.");
  }

  // Confirm email ВКЛ → session отсутствует, нужно подтверждение по письму.
  return NextResponse.json({ ok: true, needsConfirm: !data.session });
}
