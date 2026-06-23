/**
 * Санитайзер параметра `next` для редиректов после логина (защита от open-redirect).
 * Принимает ТОЛЬКО внутренний относительный путь, начинающийся с одного `/`.
 * Режет `//evil.com` (protocol-relative), абсолютные URL и backslash-трюки (`/\evil`).
 * Невалидное → `/`.
 */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback;
  // только одиночный ведущий слэш; '//' и '/\' уводят на чужой хост
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (next.includes('\\')) return fallback;
  return next;
}
