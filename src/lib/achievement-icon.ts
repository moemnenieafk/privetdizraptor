// URL иконки достижения EFT. Трёхуровневый резолв (зеркалит item-icon.ts):
// прод — Cloudflare R2 (zero egress) по ключу achievements/eft/{id}.webp
// (залив: `npm run db:upload-achievements-r2`); фолбэк — Supabase Storage `cta-media`,
// затем локальный /public (public/images/achievements/eft/{id}.webp — те же файлы).
// Прежний баг: компонент грузил /images/achievements/<id>.webp (без /eft/) → все иконки 404.
const R2_BASE = process.env.NEXT_PUBLIC_ICON_BASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function achievementIconUrl(id: string): string {
  if (R2_BASE) return `${R2_BASE}/achievements/eft/${id}.webp`;
  const base = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/cta-media` : "/images";
  return `${base}/achievements/eft/${id}.webp`;
}

// Фолбэк, если конкретной иконки нет (кол-во файлов ≠ кол-ву достижений на вайпах).
export const ACHIEVEMENT_ICON_FALLBACK = "/images/placeholder.webp";
