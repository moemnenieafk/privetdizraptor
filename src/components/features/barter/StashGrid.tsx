'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useBarterStore } from '@/store/useBarterStore';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { isArbitrageProfitable, formatRub } from '@/lib/barter-calc';
import { StashItemTile } from './StashItemTile';
import { StashItemTooltip } from './StashItemTooltip';
import type { StashItem } from '@/types/barter';

const CELL = 53;
const GAP = 1;

type TooltipState = { item: StashItem; x: number; y: number };

export function StashGrid() {
  const stashCols = useBarterStore((s) => s.stashCols);
  const stashRows = useBarterStore((s) => s.stashRows);
  const items = useBarterStore((s) => s.items);
  const removeItem = useBarterStore((s) => s.removeItem);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const gridW = stashCols * CELL + (stashCols - 1) * GAP;
  const gridH = stashRows * CELL + (stashRows - 1) * GAP;
  const templateCols = `repeat(${stashCols}, ${CELL}px)`;
  const templateRows = `repeat(${stashRows}, ${CELL}px)`;

  return (
    <>
      {tooltip && <StashItemTooltip item={tooltip.item} x={tooltip.x} y={tooltip.y} />}

      {/* Mobile: compact vertical list with inline prices */}
      <div className="md:hidden">
        {items.length === 0 ? (
          <p className="py-6 font-blender-book text-sm text-text-muted">
            Схрон пуст — добавьте предметы через поиск выше.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const arbitrage = isArbitrageProfitable(item);
              return (
                <li
                  key={item.uid}
                  className="flex items-center gap-2 p-2 bg-card-menu border border-lines-hover"
                >
                  <div
                    className="relative w-9 h-9 shrink-0 border border-lines-hover"
                    style={{ background: getTarkovBackgroundColor(item.backgroundColor) }}
                  >
                    {item.image512pxLink && (
                      <Image
                        src={item.image512pxLink}
                        alt={item.shortName}
                        fill
                        className="object-contain p-0.5"
                        sizes="36px"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-blender-book text-sm text-text-primary truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="font-blender-medium text-type-caption uppercase text-text-muted">
                        {item.width}×{item.height}
                      </span>
                      {item.fleaPrice !== null && (
                        <span
                          className="font-blender-medium text-type-caption"
                          style={{
                            color: arbitrage
                              ? 'var(--color-success)'
                              : 'var(--color-text-secondary)',
                          }}
                        >
                          {formatRub(item.fleaPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                  {arbitrage && (
                    <span className="shrink-0 font-blender-medium text-type-caption uppercase text-success border border-success/40 px-1.5 py-0.5">
                      АРБИТРАЖ
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item.uid)}
                    className="text-text-muted hover:text-failure transition-colors duration-150 p-1 shrink-0"
                    title={`Убрать ${item.shortName}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Desktop: stash grid */}
      <div
        className="relative hidden rounded border border-lines-hover bg-card-menu p-2 shadow-[inset_0_0_24px_rgba(0,0,0,0.5)] md:block"
        style={{ width: gridW + 18, height: gridH + 18 }}
      >
      <div
        className="relative"
        style={{ width: gridW, height: gridH }}
      >
        {/* Layer 1: background cells */}
        <div
          className="absolute inset-0"
          style={{
            display: 'grid',
            gridTemplateColumns: templateCols,
            gridTemplateRows: templateRows,
            gap: `${GAP}px`,
            background: 'var(--color-lines-hover)',
          }}
        >
          {Array.from({ length: stashRows * stashCols }).map((_, i) => (
            <div key={i} className="bg-(--color-darkbase)" />
          ))}
        </div>

        {/* Layer 2: placed items overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            display: 'grid',
            gridTemplateColumns: templateCols,
            gridTemplateRows: templateRows,
            gap: `${GAP}px`,
          }}
        >
          {items.map((item) => (
            <div
              key={item.uid}
              className="pointer-events-auto"
              style={{
                gridColumn: `${item.col + 1} / span ${item.width}`,
                gridRow: `${item.row + 1} / span ${item.height}`,
              }}
            >
              <StashItemTile
                item={item}
                onHover={(x, y) => setTooltip({ item, x, y })}
                onHoverMove={(x, y) =>
                  setTooltip((prev) => (prev ? { ...prev, x, y } : null))
                }
                onLeave={() => setTooltip(null)}
              />
            </div>
          ))}
        </div>
      </div>
      </div>
    </>
  );
}
