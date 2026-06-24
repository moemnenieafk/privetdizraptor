// Проверка Cloudflare Turnstile — слой капчи поверх rate-limit для auth-роутов.
// Секрет только на сервере (TURNSTILE_SECRET_KEY). Site-key публичный (NEXT_PUBLIC_).
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Капча включена, только если задан секрет (иначе флоу работает без неё). */
export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

/**
 * Проверяет Turnstile-токен через siteverify.
 * - секрет не задан → true (капча выключена, не блокируем);
 * - токен пустой → false; явный success=false → false;
 * - сеть к Cloudflare упала → true (fail-open: не ломаем вход на блипе CF;
 *   rate-limit и лимиты GoTrue остаются защитой).
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  ip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (ip && ip !== "unknown") form.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body: form });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return true; // fail-open на сетевой сбой
  }
}
