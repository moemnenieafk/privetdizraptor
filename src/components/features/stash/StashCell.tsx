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
  /** Предмет помечен «найдено в рейде» (fir > 0) → бейдж FiR в углу. */
  fir?: boolean;
  /** Режим пометки FiR: клик по ячейке переключает метку (onToggleFir), не меняя счётчик. */
  markMode?: boolean;
  onToggleFir?: () => void;
}

export function StashCell({ meta, count, onInc, href, cellPx = CELL_PX, fir = false, markMode = false, onToggleFir }: StashCellProps) {
  const width = Math.max(1, meta.gridWidth) * cellPx;
  const height = Math.max(1, meta.gridHeight) * cellPx;

  // Бейдж «найдено в рейде» (низ-лево): аутентичный FiR-глиф в цвете легендарной редкости.
  const firBadge = fir ? (
    <span title="Найдено в рейде" className="flex h-5 w-5 items-center justify-center">
      <span aria-hidden className="h-3 w-3 icon-mask icon-eft-quests-side bg-(--color-rarity-legendary)" />
    </span>
  ) : undefined;

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
    <div style={{ width, height }} className="relative shrink-0">
      <TrackCell
        iconSrc={itemIconUrl(meta.inGameId)}
        alt={meta.shortName || meta.name}
        have={count}
        need={STASH_MAX}
        onInc={onInc}
        noFill
        iconFill
        badge={count}
        hideBadge={count <= 1}
        bgColor={getTarkovBackgroundColor(meta.backgroundColor ?? undefined)}
        sizeClass="h-full w-full"
        topRight={link}
        bottomLeft={firBadge}
      />

      {/* Режим пометки: перехватываем клик поверх всей ячейки (z-50 — выше слоёв +/− и ссылки).
          ЛКМ/ПКМ одинаково переключают FiR-метку. Кольцо-подсветка = «ячейка кликабельна». */}
      {markMode && (
        <button
          type="button"
          aria-label={`${meta.name} — переключить «найдено в рейде»`}
          title={fir ? `${meta.name} — снять «найдено в рейде»` : `${meta.name} — отметить «найдено в рейде»`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFir?.();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFir?.();
          }}
          className={`absolute inset-0 z-50 cursor-pointer rounded-sm transition-shadow ${
            fir
              ? 'ring-2 ring-(--color-rarity-legendary) ring-inset'
              : 'ring-1 ring-inset ring-(--primary)/40 hover:ring-2 hover:ring-(--primary)'
          }`}
        />
      )}
    </div>
  );
}
