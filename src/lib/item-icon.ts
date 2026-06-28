// Единая точка построения URL иконки предмета EFT (items/eft/{id}.webp).
// База — из NEXT_PUBLIC_ICON_BASE_URL: Cloudflare R2 (zero egress, см. решение
// icon-hosting-r2). Фолбэки: Supabase Storage `cta-media` → локальный /public.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ICON_BASE =
  process.env.NEXT_PUBLIC_ICON_BASE_URL ??
  (SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/cta-media` : "/images");

export function itemIconUrl(inGameId: string): string {
  return `${ICON_BASE}/items/eft/${inGameId}.webp`;
}
