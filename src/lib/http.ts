// Мелкие HTTP-хелперы для route handlers.

/**
 * Переразмерное тело по Content-Length — для раннего 413 ДО буферизации/парсинга.
 * Защита от расхода памяти/CPU на JSON.parse гигантских тел (defense-in-depth;
 * платформенный лимит Vercel ~4.5МБ — верхняя граница, но явный кап надёжнее).
 */
export function bodyTooLarge(req: Request, maxBytes: number): boolean {
  const len = Number(req.headers.get("content-length") ?? "0");
  return Number.isFinite(len) && len > maxBytes;
}

/** Разумный потолок для наших JSON-роутов прогресса/аккаунта. */
export const JSON_BODY_CAP = 512 * 1024; // 512 КБ
