// POST /api/account/email — смена e-mail текущего юзера (Фаза 2-идентичность).
// auth.updateUser({ email }) → Supabase шлёт письмо-подтверждение на новый адрес.
// emailRedirectTo = финальный пункт /account (token_hash-шаблон сам ведёт на
// /auth/confirm?type=email_change&next={{RedirectTo}}, как и magic-link login).
// ⚠️ Шаблон Change-Email в Supabase Dashboard должен зеркалить magic-link — действие Вадима.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err(401, "Не авторизован");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "Некорректный запрос");
  }
  const email = typeof (body as { email?: unknown })?.email === "string"
    ? (body as { email: string }).email.trim()
    : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return err(422, "Введите корректный e-mail");
  }
  if (user.email && email.toLowerCase() === user.email.toLowerCase()) {
    return err(422, "Это ваш текущий e-mail");
  }

  const origin = new URL(req.url).origin;
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${origin}/account` },
  );
  if (error) {
    return err(400, "Не удалось отправить подтверждение. Попробуйте позже.");
  }

  return NextResponse.json({ ok: true });
}
