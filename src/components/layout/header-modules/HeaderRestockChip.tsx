'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useGameMode } from '@/hooks/useGameMode';
import { useRestockStore, useRestockTick } from '@/store/useRestockStore';
import { nextRestockMs, formatRestockHMS } from '@/lib/eft-restock';
import { RestockDrawer } from '@/components/features/traders/restock/RestockDrawer';

/**
 * Компактный индикатор ЗАВОЗА в мобильном хедере (Figma M1 2586:2197 / Q1 —
 * ROW1: [лого] … [ЗАВОЗ + время] [бургер]). Аватар ближайшего торговца + «ЗАВОЗ» /
 * живой обратный таймер; тап открывает тот же drawer, что и десктопный RestockDock.
 *
 * Мобильный слой: `xl:hidden` — на десктопе индикатор даёт плавающий RestockDock,
 * здесь дубль не нужен. Скоуп зеркалит RestockDock: показываем только под `/eft`
 * (завоз — EFT-специфичная фича, данные/API — всё `/eft`); на хабе выбора игры и в
 * других разделах не монтируемся вовсе — ни тика, ни загрузки.
 *
 * Данные автономны (§4.11): useRestockStore тянет из нашего зеркала
 * (/api/eft/traders/restock), тикает 1 Гц; nextRestockMs/formatRestockHMS — чистые
 * хелперы. Никакого рантайм-фетча наружу.
 */
export function HeaderRestockChip() {
  const pathname = usePathname();
  const game = (pathname || '').split('/').filter(Boolean)[0];
  if (game !== 'eft') return null;
  return <HeaderRestockChipActive />;
}

function HeaderRestockChipActive() {
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

  // Пока в зеркале нет данных рестока — место у бургера не занимаем пустышкой.
  if (nearest == null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Завоз у торговцев"
        title="Завоз у торговцев"
        className="flex shrink-0 items-center gap-2 rounded-xs transition-opacity hover:opacity-80 xl:hidden"
      >
        <span className="relative size-6 shrink-0 overflow-hidden rounded-xs border border-(--color-base) bg-(--color-base)">
          {nearest.trader.image && (
            <Image src={nearest.trader.image} alt={nearest.trader.nameRu} fill sizes="24px" className="object-cover" />
          )}
        </span>
        <span className="flex flex-col items-start gap-0.5 leading-none">
          <span className="text-type-micro font-blender-medium uppercase leading-none text-text-secondary">Завоз</span>
          <span className="text-type-micro font-blender-medium leading-none tabular-nums text-tactical-amber">
            {formatRestockHMS(Math.max(0, nearest.next - now))}
          </span>
        </span>
      </button>

      <RestockDrawer isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
