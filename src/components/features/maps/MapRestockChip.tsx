'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useGameMode } from '@/hooks/useGameMode';
import { useRestockStore, useRestockTick } from '@/store/useRestockStore';
import { nextRestockMs, formatRestockHMS } from '@/lib/eft-restock';
import { RestockDrawer } from '@/components/features/traders/restock/RestockDrawer';

/**
 * Компактный индикатор ЗАВОЗА для мобильной панели карты (M1 Figma 2586:2197).
 * Аватар ближайшего торговца + «ЗАВОЗ» / живой обратный таймер. Тап открывает
 * полный drawer завоза (тот же, что у десктопного RestockDock).
 *
 * Данные — автономны (§4.11): useRestockStore тянет из нашего зеркала
 * (/api/eft/traders/restock), тикает 1 Гц; nextRestockMs/formatRestockHMS — чистые
 * хелперы. Никакого рантайм-фетча наружу. Виджет всегда под /eft/maps, поэтому
 * грузим/тикаем прямо здесь (в отличие от RestockDock, который сам гейтит по /eft).
 */
export function MapRestockChip() {
  const mode = useGameMode();
  const traders = useRestockStore((s) => s.traders);
  const now = useRestockStore((s) => s.now);
  const load = useRestockStore((s) => s.load);
  const [open, setOpen] = useState(false);

  useRestockTick();
  useEffect(() => {
    load(mode);
  }, [mode, load]);

  const nearest = useMemo(() => {
    let best: { trader: (typeof traders)[number]; next: number } | null = null;
    for (const t of traders) {
      const next = nextRestockMs(t.resetTime, t.intervalSec, now);
      if (next != null && (best == null || next < best.next)) best = { trader: t, next };
    }
    return best;
  }, [traders, now]);

  // Пока в зеркале нет данных рестока — панель не занимаем пустышкой.
  if (nearest == null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Завоз у торговцев"
        title="Завоз у торговцев"
        className="flex shrink-0 items-center gap-2 rounded-xs transition-opacity hover:opacity-80"
      >
        <span className="relative size-6 shrink-0 overflow-hidden rounded-xs border border-black/50 bg-(--color-base)">
          {nearest.trader.image && (
            <Image src={nearest.trader.image} alt={nearest.trader.nameRu} fill sizes="24px" className="object-cover" />
          )}
        </span>
        <span className="flex flex-col items-start gap-0.5 leading-none">
          <span className="font-blender-medium text-[10px] uppercase leading-none text-(--color-text-secondary)">Завоз</span>
          <span className="font-blender-medium text-[10px] leading-none tabular-nums text-tactical-amber">
            {formatRestockHMS(Math.max(0, nearest.next - now))}
          </span>
        </span>
      </button>

      <RestockDrawer isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
