// Единая парольная политика портала. Один источник правды для сервера (register)
// и клиента (форма регистрации, сброс пароля) — чтобы правило не разъезжалось.
//
// ВАЖНО: клиентские/серверные проверки здесь — это UX + defense-in-depth.
// Настоящий серверный гейт на ВСЕ операции (в т.ч. reset через supabase.auth.updateUser,
// который идёт мимо наших ручек) даёт сам GoTrue. На self-hosted Supabase выставить в env:
//   GOTRUE_PASSWORD_MIN_LENGTH=12
//   GOTRUE_PASSWORD_REQUIRED_CHARACTERS="abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789"
// (см. docs/decisions/security-hardening-15.md).

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export const PASSWORD_HINT = `Минимум ${PASSWORD_MIN} символов: строчные, заглавные и цифры.`;

/**
 * Проверяет пароль по политике портала.
 * Требует длину 12–128 и минимум 3 класса из 4: строчная, заглавная, цифра, символ.
 * @returns null если ок, иначе строка-ошибка для показа пользователю.
 */
export function validatePassword(password: string): string | null {
  if (typeof password !== "string") return "Введите пароль";
  if (password.length < PASSWORD_MIN) return `Пароль: минимум ${PASSWORD_MIN} символов`;
  if (password.length > PASSWORD_MAX) return `Пароль: максимум ${PASSWORD_MAX} символов`;

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (classes < 3) {
    return "Пароль слабый: смешайте строчные, заглавные буквы и цифры";
  }
  return null;
}

/** Быстрый булев-хелпер для дизейбла кнопок на клиенте. */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password) === null;
}
