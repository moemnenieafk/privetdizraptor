'use client';

import Image from 'next/image';
import {
  nextRestockMs,
  cycleProgress,
  formatRestockHMS,
  formatAbsoluteHM,
  type RestockTrader,
} from '@/lib/eft-restock';
import { traderCssVar } from '@/lib/trader-utils';

function BellIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
      {muted && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

interface RestockCardProps {
  trader: RestockTrader;
  now: number;
  muted: boolean;
  onToggleMute: () => void;
}

export function RestockCard({ trader, now, muted, onToggleMute }: RestockCardProps) {
  const next = nextRestockMs(trader.resetTime, trader.intervalSec, now);
  const remaining = next != null ? Math.max(0, next - now) : 0;
  const elapsed = trader.intervalSec * 1000 - remaining;
  const justReset = next != null && elapsed < 60_000;
  const urgent = !justReset && next != null && remaining < 60_000;
  const progress = next != null ? cycleProgress(next, trader.intervalSec, now) : 0;

  // Цвет торговца — тринт-фон/обводка/полоска/таймер; семантика перебивает.
  const traderColor = `var(${traderCssVar(trader.slug)}, var(--color-tactical-amber))`;
  const semantic = justReset || urgent;

  const timerClass = justReset ? 'text-online' : urgent ? 'text-danger animate-pulse' : '';
  const timerStyle = semantic ? undefined : { color: traderColor };

  const barClass = justReset ? 'bg-online' : urgent ? 'bg-danger' : '';
  const barStyle = semantic ? undefined : { backgroundColor: traderColor };
  const cardBg = `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 15%, transparent), rgba(0,0,0,0.9))`;

  return (
    <div
      style={{ background: cardBg, borderColor: `color-mix(in srgb, ${traderColor} 50%, transparent)` }}
      className={`relative flex items-center gap-3 overflow-hidden rounded border py-2.5 pr-2 pl-3 transition-opacity ${muted ? 'opacity-55' : ''}`}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xs bg-(--color-base)">
        {trader.image && (
          <Image src={trader.image} alt={trader.nameRu} fill sizes="40px" className="object-cover" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-blender-medium uppercase leading-4 tracking-wide text-text-primary">
          {trader.nameRu}
        </span>
        <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          валюта: {trader.currency}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end">
        <span
          style={timerStyle}
          className={`text-xl font-blender-medium leading-none tracking-wide tabular-nums ${timerClass}`}
        >
          {formatRestockHMS(remaining)}
        </span>
        <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          {justReset ? '✓ обновлён' : next != null ? `в ${formatAbsoluteHM(next)}` : '—'}
        </span>
      </div>

      <button
        type="button"
        onClick={onToggleMute}
        title={muted ? 'Включить напоминание' : 'Выключить напоминание'}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-xs transition-colors hover:bg-lines-hover ${muted ? 'text-text-muted' : 'text-tactical-amber'}`}
      >
        <BellIcon muted={muted} />
      </button>

      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-lines-hover">
        <div
          className={`h-full ${barClass} transition-[width] duration-1000 ease-linear`}
          style={{ width: `${Math.round(progress * 100)}%`, ...barStyle }}
        />
      </div>
    </div>
  );
}
