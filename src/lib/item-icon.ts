// Единая точка построения URL иконки предмета EFT.
// Иконки лежат в публичном бакете Supabase Storage `cta-media` (items/eft/{id}.webp).
// Фолбэк на локальный /public — на случай, если NEXT_PUBLIC_SUPABASE_URL не задан.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function itemIconUrl(inGameId: string): string {
  return SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/cta-media/items/eft/${inGameId}.webp`
    : `/images/items/eft/${inGameId}.webp`;
}
