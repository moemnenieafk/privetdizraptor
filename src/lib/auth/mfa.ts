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

/**
 * Привязан ли у пользователя подтверждённый TOTP-фактор.
 *
 * Нужно кабинету, чтобы строка «Двухфакторная аутентификация» говорила правду: раньше
 * она хардкодила «Не настроено» и врала юзеру с включённым 2FA. Считается на сервере,
 * чтобы вкладка «Безопасность» не мигала состоянием после гидрации.
 *
 * Ошибка провайдера → false: честнее предложить настроить (внутри мастера статус
 * перепроверяется), чем показать «включено» там, где мы не уверены.
 */
export async function hasVerifiedTotp(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return false;
    return (data.totp ?? []).some((f) => f.status === "verified");
  } catch {
    return false;
  }
}
