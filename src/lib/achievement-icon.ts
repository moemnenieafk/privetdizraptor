// URL иконки достижения EFT. Файлы лежат локально в public/images/achievements/eft/<id>.webp
// (в отличие от иконок предметов, ещё НЕ зеркалятся в cta-media/R2 — это отдельная задача-хостинг).
// Прежний баг: компонент грузил /images/achievements/<id>.webp (без /eft/) → все иконки 404.
export function achievementIconUrl(id: string): string {
  return `/images/achievements/eft/${id}.webp`;
}

// Фолбэк, если конкретной иконки нет (кол-во файлов ≠ кол-ву достижений на вайпах).
export const ACHIEVEMENT_ICON_FALLBACK = "/images/placeholder.webp";
