// Единая точка построения URL подложки карты EFT.
// Прод-цель: Cloudflare R2 (zero egress). Задай NEXT_PUBLIC_MAP_BASE_URL (тот же R2-базовый
// URL, что и у иконок — NEXT_PUBLIC_ICON_BASE_URL) ПОСЛЕ заливки SVG в R2
// (`npm run db:upload-maps-r2`, ключ maps/eft/{slug}.svg). Пока переменная не задана —
// поведение прежнее: Supabase Storage cta-media, затем локальный /public.
// ⚠️ Не переиспользуем ICON_BASE напрямую: карты нужно СНАЧАЛА залить в R2, иначе
// один и тот же base отдал бы 404. Отдельная переменная = осознанный, безопасный флип.
const MAP_R2_BASE = process.env.NEXT_PUBLIC_MAP_BASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function mapImageUrl(slug: string): string {
  if (MAP_R2_BASE) return `${MAP_R2_BASE}/maps/eft/${slug}.svg`;
  return SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/cta-media/maps/eft/${slug}.svg`
    : `/images/maps/eft/${slug}.svg`;
}
