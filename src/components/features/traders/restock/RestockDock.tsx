'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useGameMode } from '@/hooks/useGameMode';
import { useRestockStore, useRestockTick } from '@/store/useRestockStore';
import { nextRestockMs, formatRestockHMS } from '@/lib/eft-restock';
import { RestockDrawer } from './RestockDrawer';

/**
 * Гейт по разделу: завоз — EFT-специфичная фича (данные/API — всё `/eft`).
 * На главной (игра не выбрана) и в других разделах виджет не монтируется вовсе —
 * ни тика, ни загрузки. Принцип: плавающие виджеты игры показываем только под её
 * неймспейсом (`/eft/*`), не на хабе выбора игры.
 */
export function RestockDock() {
  const pathname = usePathname();
  const game = (pathname || '').split('/').filter(Boolean)[0];
  if (game !== 'eft') return null;
  return <RestockDockActive />;
}

/**
 * Плавающий закреплённый виджет завоза — доком к правой кромке, сверху
 * (вне потока контента, как ScrollToTop). Показывает живой таймер ближайшего
 * завоза; клик открывает боковой drawer.
 */
function RestockDockActive() {
  const mode = useGameMode();
  const traders = useRestockStore((s) => s.traders);
  const now = useRestockStore((s) => s.now);
  const load = useRestockStore((s) => s.load);
  const [open, setOpen] = useState(false);

  useRestockTick();
  useEffect(() => {
    load(mode);
  }, [mode, load]);

  // Прячемся: (1) пока открыт боковой drawer квеста — он в контексте наложения страницы и иначе
  // оказывается под нашим корневым fixed z-40; (2) в любом фуллскрин-режиме фрейма (карты и
  // квест-карта, оба z-[200]) — как StreamDock/StreamStatus. Единый body-атрибут-мост, один observer.
  const [questDrawerOpen, setQuestDrawerOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const check = () => {
      setQuestDrawerOpen(
        document.body.hasAttribute('data-quest-drawer') || document.body.hasAttribute('data-app-drawer'),
      );
      setFullscreen(
        document.body.hasAttribute('data-app-fullscreen') ||
          document.body.hasAttribute('data-quest-fullscreen'),
      );
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-quest-drawer', 'data-app-drawer', 'data-app-fullscreen', 'data-quest-fullscreen'],
    });
    check();
    return () => observer.disconnect();
  }, []);

  const nearest = useMemo(() => {
    let best: { trader: (typeof traders)[number]; next: number } | null = null;
    for (const t of traders) {
      const next = nextRestockMs(t.resetTime, t.intervalSec, now);
      if (next != null && (best == null || next < best.next)) best = { trader: t, next };
    }
    return best;
  }, [traders, now]);

  // Пока в зеркале нет данных рестока — не мозолим глаза пустым виджетом.
  if (nearest == null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Завоз у торговцев"
        title="Завоз у торговцев"
        className={`fixed right-0 top-6 z-40 flex items-center gap-2 rounded-l border border-r-0 border-lines-hover py-2 pr-2 pl-3 shadow-lg backdrop-blur-sm transition-all duration-300 max-xl:hidden
          bg-[color-mix(in_srgb,var(--color-base)_90%,transparent)]
          hover:border-(--primary) hover:shadow-[0_0_16px_color-mix(in_srgb,var(--primary)_25%,transparent)]
          ${questDrawerOpen ? 'pointer-events-none opacity-0' : ''}
          ${fullscreen ? 'invisible pointer-events-none' : ''}`}
      >
        <span className="h-4 w-4 shrink-0 icon-mask icon-eft-trader-restock text-tactical-amber" />
        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-xs bg-(--color-base)">
          {nearest.trader.image && (
            <Image
              src={nearest.trader.image}
              alt={nearest.trader.nameRu}
              fill
              sizes="28px"
              className="object-cover"
            />
          )}
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Завоз
          </span>
          <span className="text-xs font-blender-medium tracking-wide tabular-nums text-tactical-amber">
            {formatRestockHMS(Math.max(0, nearest.next - now))}
          </span>
        </div>
      </button>

      <RestockDrawer isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
