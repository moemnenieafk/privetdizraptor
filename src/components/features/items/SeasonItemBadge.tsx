import type { SeasonItemCategory } from '@/data/eft-season-items';
import { SEASON_ITEM_CATEGORIES } from '@/data/eft-season-items';

// Бейдж принадлежности предмета к сезону / Боевому пропуску KORD BREACH.
// Вордмарк-иконка (монохромный SVG-shape) красится CSS-маской в цвет сезона (bg-season-01).
//   battle-pass → «BATTLE PASS» вордмарк (battlepass-text-icon, 435×45).
//   kord-breach → короткий лого сезона (kord-breach-logo-short, 77×12).
// Аспект зашит из viewBox SVG; высота задаётся пропом, ширина — из aspect-ratio.
const BADGE: Record<SeasonItemCategory, { icon: string; aspect: number }> = {
  'battle-pass': { icon: 'icon-eft-battlepass-text', aspect: 435 / 45 },
  'kord-breach': { icon: 'icon-eft-kord-breach-logo-short', aspect: 77 / 12 },
};

export interface SeasonItemBadgeProps {
  category: SeasonItemCategory;
  /** Высота вордмарка в px (ширина считается из аспекта). По умолчанию 12. */
  height?: number;
  className?: string;
}

/** Бейдж сезонного предмета — вордмарк в цвете сезона (--color-season-01). */
export function SeasonItemBadge({ category, height = 12, className = '' }: SeasonItemBadgeProps) {
  const meta = SEASON_ITEM_CATEGORIES[category];
  const { icon, aspect } = BADGE[category];
  return (
    <span
      role="img"
      aria-label={meta.badge}
      title={meta.label}
      className={`icon-mask ${icon} bg-season-01 inline-block shrink-0 ${className}`}
      style={{ height, aspectRatio: aspect }}
    />
  );
}
