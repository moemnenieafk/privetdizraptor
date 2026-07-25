'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useGameMode } from '@/hooks/useGameMode';
import { getGameTitle } from '@/data/games';
import { useRestockStore, useRestockTick } from '@/store/useRestockStore';
import { nextRestockMs, formatRestockHMS, RESTOCK_OFFSETS } from '@/lib/eft-restock';
import { traderCssVar } from '@/lib/trader-utils';
import { RestockCard } from './RestockCard';

function SoundIcon({ on }: { on: boolean }) {
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
      <path d="M11 5 6 9H2v6h4l5 4z" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 6a9 9 0 0 1 0 12" />
        </>
      ) : (
        <>
          <line x1="16" y1="9" x2="22" y2="15" />
          <line x1="22" y1="9" x2="16" y2="15" />
        </>
      )}
    </svg>
  );
}

interface RestockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Боковой слайд-drawer рестока (348px, справа) — паттерн Карты заданий (QuestDrawer). */
export function RestockDrawer({ isOpen, onClose }: RestockDrawerProps) {
  const mode = useGameMode();

  // Каноничная slide-анимация + Esc. modalRef НЕ вешаем на панель:
  // useClickOutside гардит на ref.current → клик-снаружи не закрывает,
  // страница остаётся видимой и кликабельной (следим за рестоком предмета).
  // Закрытие — только крестик / Esc. Скрима нет — фон не глушим.
  const { isRendered, isVisible } = useModalAnimation(isOpen, onClose);

  // Название игры тянем из текущего раздела сайта (первый сегмент пути), как в Header.
  const pathname = usePathname();
  const gameTitle = getGameTitle((pathname || '').split('/').filter(Boolean)[0] || 'eft');

  const traders = useRestockStore((s) => s.traders);
  const now = useRestockStore((s) => s.now);
  const status = useRestockStore((s) => s.status);
  const prefs = useRestockStore((s) => s.prefs);
  const notifPerm = useRestockStore((s) => s.notifPerm);
  const load = useRestockStore((s) => s.load);
  const setOffset = useRestockStore((s) => s.setOffset);
  const toggleSound = useRestockStore((s) => s.toggleSound);
  const toggleMute = useRestockStore((s) => s.toggleMute);
  const requestPerm = useRestockStore((s) => s.requestPerm);

  useRestockTick();
  useEffect(() => {
    if (isOpen) load(mode);
  }, [isOpen, mode, load]);

  // Живая сортировка: чем ближе ресток — тем выше. Пересчёт на каждый тик,
  // торговец после рестока сам «уезжает» вниз, следующий — всплывает вверх.
  const sorted = useMemo(
    () =>
      traders
        .map((t) => ({ trader: t, next: nextRestockMs(t.resetTime, t.intervalSec, now) }))
        .filter((x): x is { trader: (typeof traders)[number]; next: number } => x.next != null)
        .sort((a, b) => a.next - b.next),
    [traders, now],
  );
  const nearest = sorted[0] ?? null;

  if (!isRendered) return null;

  return (
    <>
      {/* панель 348px — поверх страницы, без затемнения фона */}
      <div
        className={`fixed inset-y-0 right-0 z-200 flex w-87 max-w-full flex-col border-l border-card-menu bg-(--color-darkbase) shadow-2xl transition-transform duration-200 ease-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* ═══ ШАПКА ═══ */}
        <div className="flex shrink-0 items-start justify-between border-b border-card-menu px-4 pt-3.5 pb-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 icon-mask icon-eft-trader-restock text-tactical-amber" />
              <h2 className="text-base font-blender-medium uppercase leading-5 tracking-widest text-text-primary">
                Завоз у торговцев
              </h2>
            </div>
            <p className="text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
              По игре {gameTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex shrink-0 items-center justify-center p-1 transition-opacity hover:opacity-80"
          >
            {/* красный бокс 16×12 (w-4 h-3) — пропорции из Figma; X внутри квадратный */}
            <span className="flex h-3 w-4 items-center justify-center rounded-xs bg-danger-dim">
              <span className="h-2 w-2 icon-mask icon-eft-profile-btn-close text-zinc-100" />
            </span>
          </button>
        </div>

        {/* ═══ ТЕЛО (скролл) ═══ */}
        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
          {/* ближайший ресток */}
          {nearest && (
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xs bg-(--color-base)">
                {nearest.trader.image && (
                  <Image src={nearest.trader.image} alt={nearest.trader.nameRu} fill sizes="44px" className="object-cover" />
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                  Ближайший завоз
                </span>
                <span className="truncate text-sm font-blender-medium uppercase leading-4 tracking-wide text-text-primary">
                  {nearest.trader.nameRu}
                </span>
              </div>
              <span
                style={{ color: `var(${traderCssVar(nearest.trader.slug)}, var(--color-tactical-amber))` }}
                className="ml-auto text-2xl font-blender-medium leading-none tracking-wide tabular-nums"
              >
                {formatRestockHMS(Math.max(0, nearest.next - now))}
              </span>
            </div>
          )}

          {/* напомнить до рестока */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
                Напомнить до завоза
              </span>
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={prefs.sound}
                title={prefs.sound ? 'Звук включён' : 'Звук выключен'}
                className={`flex items-center gap-1.5 text-type-micro font-blender-medium uppercase tracking-widest transition-colors ${prefs.sound ? 'text-tactical-amber' : 'text-text-muted hover:text-text-secondary'}`}
              >
                <SoundIcon on={prefs.sound} />
                звук
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {RESTOCK_OFFSETS.map((o) => {
                const active = prefs.offsetSec === o.sec;
                return (
                  <button
                    key={o.sec}
                    type="button"
                    onClick={() => setOffset(o.sec)}
                    className={`rounded-xs border py-1 text-type-micro font-blender-medium uppercase tracking-widest transition-colors ${active ? 'border-(--primary) bg-(--primary) text-(--color-base)' : 'border-lines-hover text-text-secondary hover:bg-lines-hover'}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* разрешить уведомления */}
          {notifPerm === 'default' && (
            <button
              type="button"
              onClick={requestPerm}
              className="rounded-xs border border-lines-hover px-3 py-1.5 text-type-label font-blender-medium uppercase tracking-wide text-text-secondary transition-colors hover:border-tactical-amber hover:text-text-primary"
            >
              Разрешить уведомления браузера
            </button>
          )}
          {notifPerm === 'denied' && (
            <p className="text-type-micro font-blender-book text-danger">
              Уведомления заблокированы — разрешите их в настройках сайта.
            </p>
          )}

          {/* грид торговцев */}
          {status === 'loading' && traders.length === 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded border border-lines-hover bg-(--color-base)" />
              ))}
            </div>
          ) : status === 'error' ? (
            <p className="text-type-micro font-blender-book text-text-muted">
              Не удалось загрузить данные завоза.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {sorted.map(({ trader: t }) => (
                <RestockCard
                  key={t.slug}
                  trader={t}
                  now={now}
                  muted={prefs.mutedSlugs.includes(t.slug)}
                  onToggleMute={() => toggleMute(t.slug)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
