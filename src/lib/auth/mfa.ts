// Серверная проверка второго фактора (Supabase Auth MFA / TOTP).
// AAL = Authenticator Assurance Level: aal1 — только пароль, aal2 — пройден TOTP.
import { createClient } from "@/lib/supabase/server";

/**
 * Удовлетворяет ли текущая сессия требованию 2FA.
 * - Нет подтверждённого фактора (nextLevel=aal1) → true (нечего требовать).
 * - Фактор есть и пройден (currentLevel=aal2) → true.
 * - Фактор есть, но второй шаг не сделан (сессия aal1) → false.
 * На ошибке провайдера — fail-open (true), чтобы сбой MFA-эндпоинта не залочил
 * админа; это защита-в-глубину поверх ролевой проверки, не единственный барьер.
 */
export async function mfaSatisfied(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return true;
  if (data.nextLevel === "aal2") return data.currentLevel === "aal2";
  return true;
}
