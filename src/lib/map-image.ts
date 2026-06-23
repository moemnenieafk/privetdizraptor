// Единая точка построения URL подложки карты EFT.
// Подложки (SVG) лежат в публичном бакете Supabase Storage `cta-media` (maps/eft/{slug}.svg),
// заливаются scripts/upload-map-assets.ts. Фолбэк на локальный /public — если
// NEXT_PUBLIC_SUPABASE_URL не задан (как у item-icon.ts).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function mapImageUrl(slug: string): string {
  return SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/cta-media/maps/eft/${slug}.svg`
    : `/images/maps/eft/${slug}.svg`;
}
