import { isArbitrageProfitable, formatRub } from '@/lib/barter-calc';
import type { StashItem } from '@/types/barter';

interface Props {
  item: StashItem;
  x: number;
  y: number;
}

export function StashItemTooltip({ item, x, y }: Props) {
  const arbitrage = isArbitrageProfitable(item);

  return (
    <div
      className="w-56 bg-(--color-darkbase) border border-(--color-lines-hover) shadow-xl pointer-events-none"
      style={{ position: 'fixed', left: x + 14, top: y + 14, zIndex: 9999 }}
    >
      <div className="px-3 py-2 border-b border-(--color-lines-hover)">
        <p className="font-blender-medium text-xs uppercase tracking-widest text-(--color-text-primary) leading-tight">
          {item.name}
        </p>
        <p className="font-blender-medium text-[10px] uppercase text-(--color-text-muted) mt-0.5">
          {item.shortName} · {item.width}×{item.height}
        </p>
      </div>

      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="font-blender-medium text-[10px] uppercase text-(--color-text-muted) shrink-0">
            Барахолка
          </span>
          <span
            className="font-blender-medium text-xs"
            style={{ color: arbitrage ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
          >
            {item.fleaPrice !== null ? formatRub(item.fleaPrice) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-blender-medium text-[10px] uppercase text-(--color-text-muted) shrink-0">
            Торговец
          </span>
          <span className="font-blender-medium text-xs text-(--color-text-secondary)">
            {item.bestTraderPriceRub !== null ? formatRub(item.bestTraderPriceRub) : '—'}
          </span>
        </div>
      </div>

      {arbitrage && (
        <div className="px-3 py-1.5 border-t border-(--color-lines-hover)">
          <p className="font-blender-medium text-[9px] uppercase tracking-widest text-(--color-success)">
            ▲ арбитраж выгоден
          </p>
        </div>
      )}
    </div>
  );
}
