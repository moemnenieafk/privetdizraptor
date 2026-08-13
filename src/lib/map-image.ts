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

// Базовый префикс тайлов HD-карт (пирамида в /public/maps/{map}/tiles/**, вся папка в .gitignore
// → на Vercel её нет; без R2 боевая карта была бы пустой). Пусто → путь остаётся /maps/... из
// /public (локальный дефолт). Задан → тайлы отдаются с R2 (zero-egress).
// Цепочка фолбэков:
//  1) NEXT_PUBLIC_MAP_TILE_BASE_URL — выделенная переменная тайлов (если задашь свой tile-CDN);
//  2) MAP_R2_BASE (NEXT_PUBLIC_MAP_BASE_URL) — общий флип карт на R2, когда SVG тоже переедут;
//  3) NEXT_PUBLIC_ICON_BASE_URL — ⚠️ КЛЮЧЕВОЕ: тайлы лежат в ТОМ ЖЕ R2-бакете (cta-media), что иконки,
//     а icon-base в проде уже задан → прод отдаёт тайлы с R2 БЕЗ отдельного Vercel-env. Безопасно:
//     тайлы factory реально залиты на R2 (единственная тайловая карта); SVG-подложки это не трогает
//     (их URL строит mapImageUrl по MAP_R2_BASE, не по mapAssetBase).
export const mapAssetBase =
  process.env.NEXT_PUBLIC_MAP_TILE_BASE_URL ??
  MAP_R2_BASE ??
  process.env.NEXT_PUBLIC_ICON_BASE_URL ??
  "";
