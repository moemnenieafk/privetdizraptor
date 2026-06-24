// POST /api/account/password — отправка ссылки сброса пароля (Фаза 2-идентичность).
// Анти-абьюз: письмо уходит ТОЛЬКО на e-mail из сессии (тело запроса не используется),
// поэтому залогиненный юзер не может рассылать ссыл­ки на чужие адреса.
// redirectTo = финальный пункт назначения /reset-password. Проект использует
// token_hash email-шаблоны (как magic-link login → /auth/confirm), где шаблон сам
// ведёт на /auth/confirm?type=recovery&next={{RedirectTo}}. /reset-password также
// умеет ?code= как фолбэк на дефолтный PKCE-шаблон. ⚠️ Шаблон Reset Password в
// Supabase Dashboard должен зеркалить magic-link (token_hash) — действие Вадима.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err(401, "Не авторизован");
  if (!user.email) return err(400, "К аккаунту не привязан e-mail");

  const origin = new URL(req.url).origin;
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) {
    return err(400, "Не удалось отправить письмо. Попробуйте позже.");
  }

  // Возвращаем адрес (из сессии) — UI покажет, куда ушло письмо.
  return NextResponse.json({ ok: true, email: user.email });
}
