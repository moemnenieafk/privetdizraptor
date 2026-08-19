// Иконка задания EFT. Трёхуровневый резолв (как item-icon.ts / achievement-icon.ts):
// прод — Cloudflare R2 (zero egress) по ключу quests/eft/{taskId}.webp
// (залив: `npm run db:upload-dir-r2 -- --dir=public/images/quests/eft --prefix=quests/eft`);
// фолбэк — Supabase Storage `cta-media`, затем локальный /public. Сюжетные шоты
// (/images/quests/eft/story/...) хардкожены отдельно и пока остаются локальными.
const R2_BASE = process.env.NEXT_PUBLIC_ICON_BASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function getQuestHeroImg(taskId: string): string {
  if (R2_BASE) return `${R2_BASE}/quests/eft/${taskId}.webp`;
  const base = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/cta-media` : "/images";
  return `${base}/quests/eft/${taskId}.webp`;
}
