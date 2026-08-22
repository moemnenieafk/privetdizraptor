'use client';

// Ячейка предмета в «Схроне» — размером в реальный футпринт (gridWidth×gridHeight клеток).
// Визуал переиспользован из канон-ячейки TrackCell: рарити-фон реальным цветом предмета,
// иконка, ЛКМ +1 / ПКМ −1. В схроне нет прогресс-цели → noFill, а количество показываем
// статичным бейджем (badge) вместо трекинг-счётчика X/Y. Футпринт больше одной клетки не
// выражается статик-классом Tailwind (произвольная кратность 56px), поэтому размер задаётся
// инлайн-стилем обёртки, а TrackCell растягивается на неё (sizeClass h-full w-full).

import { ArrowUpRight } from 'lucide-react';
import { TrackCell } from '@/components/ui/kit/TrackCell';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { itemIconUrl } from '@/lib/item-icon';
import type { StashItemMeta } from '@/lib/stash-types';

const CELL_PX = 56; // одна клетка = 56px (кратно 4)
const STASH_MAX = 9999; // потолок набора (как в needed). need=count заблокировал бы ЛКМ +1
                        //  (TrackCell.inc срабатывает только при clampedHave < need).

export interface StashCellProps {
  meta: StashItemMeta;
  count: number;
  onInc: (delta: number) => void; // вызывающий кламп через bumpCount
  href?: string; // ссылка на страницу предмета (topRight-линк)
  cellPx?: number; // размер клетки в px; default CELL_PX (сетка на всю ширину → динамика)
}

export function StashCell({ meta, count, onInc, href, cellPx = CELL_PX }: StashCellProps) {
  const width = Math.max(1, meta.gridWidth) * cellPx;
  const height = Math.max(1, meta.gridHeight) * cellPx;

  const link = href ? (
    <a
      href={href}
      title={`Открыть: ${meta.name}`}
      aria-label={`Открыть страницу предмета ${meta.name}`}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center justify-center rounded-bl-xs bg-(--color-darkbase)/90 p-0.5 text-text-muted transition-colors hover:text-(--primary)"
    >
      <ArrowUpRight aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5" />
    </a>
  ) : undefined;

  return (
    <div style={{ width, height }} className="shrink-0">
      <TrackCell
        iconSrc={itemIconUrl(meta.inGameId)}
        alt={meta.shortName || meta.name}
        have={count}
        need={STASH_MAX}
        onInc={onInc}
        noFill
        iconFill
        badge={count}
        bgColor={getTarkovBackgroundColor(meta.backgroundColor ?? undefined)}
        sizeClass="h-full w-full"
        topRight={link}
      />
    </div>
  );
}
