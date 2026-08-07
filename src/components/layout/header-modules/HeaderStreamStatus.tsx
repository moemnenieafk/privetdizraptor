'use client';

import { useStreamLive } from '@/hooks/useStreamLive';
import { useStreamDockStore } from '@/store/useStreamDockStore';

/**
 * Индикатор стрима в МОБИЛЬНОМ хедере (xl:hidden) — рядом с «Завозом» и бургером.
 * LIVE = красная пилюля с пульс-точкой + «LIVE» (клик разворачивает fullkamen-док);
 * OFFLINE = серая компактная точка (ссылка на твич). Десктоп берёт плавающий StreamStatus.
 * Данные — общий хук useStreamLive (§4.11-safe: наш /api/twitch-status).
 */
export function HeaderStreamStatus() {
  const { isLive, isLoading } = useStreamLive();
  const expandDock = useStreamDockStore((s) => s.expand);

  const base = 'flex h-10 w-10 shrink-0 items-center justify-center rounded border transition-colors xl:hidden';

  if (isLoading) {
    return (
      <span className={`${base} border-lines-hover`} aria-hidden style={{ backgroundColor: 'var(--color-base)' }}>
        <span className="size-2 rounded-full bg-neutral-600" />
      </span>
    );
  }

  if (isLive) {
    return (
      <button
        onClick={() => expandDock('fullkamen')}
        title="Развернуть окно стрима"
        aria-label="Стрим в эфире — развернуть"
        style={{ backgroundColor: 'var(--color-base)' }}
        className={`${base} border-danger hover:brightness-125`}
      >
        <span className="relative flex size-2.5 items-center justify-center">
          <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-danger opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
        </span>
      </button>
    );
  }

  return (
    <a
      href="https://www.twitch.tv/fullkamen"
      target="_blank"
      rel="noopener noreferrer"
      title="Стрим оффлайн — открыть Twitch"
      aria-label="Стрим оффлайн"
      style={{ backgroundColor: 'var(--color-base)' }}
      className={`${base} border-lines-hover text-text-muted hover:border-(--primary)/40`}
    >
      <span className="size-2 rounded-full bg-text-muted" />
    </a>
  );
}
