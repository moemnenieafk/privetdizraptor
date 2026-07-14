import { BookOpen, Coins, Flame, Handshake, Settings2, Skull, Snowflake, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EftEventCategory } from '@/types/eft-events';

/**
 * Статичная карта иконок по категориям. Без динамических классов —
 * Tailwind v4 их вырезает при tree-shaking (см. кейс TRADER_COLORS).
 */
const CATEGORY_ICONS: Record<EftEventCategory, LucideIcon> = {
  lore: BookOpen,
  seasonal: Snowflake,
  boss: Skull,
  economy: Coins,
  gameplay: Settings2,
  prewipe: Flame,
  community: Users,
  collab: Handshake,
};

export function EventCategoryGlyph({ category }: { category: EftEventCategory }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon aria-hidden="true" className="size-4.5" />;
}
