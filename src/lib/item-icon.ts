// Единая точка построения URL иконки предмета EFT.
// Прод: Cloudflare R2 (zero egress) — 512px-иконки по ВЕРСИОНИРОВАННОМУ пути
// items/eft/512/{id}.webp (новый ключ обходит immutable-кэш старых 256px; см.
// upload-icons-r2.ts). Фолбэки (Supabase Storage `cta-media` / локальный /public) —
// прямой путь items/eft/{id}.webp, где оригиналы и так 512px.
const R2_BASE = process.env.NEXT_PUBLIC_ICON_BASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function itemIconUrl(inGameId: string): string {
  if (R2_BASE) return `${R2_BASE}/items/eft/512/${inGameId}.webp`;
  const base = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/cta-media` : "/images";
  return `${base}/items/eft/${inGameId}.webp`;
}
