'use client';

interface Props {
  isFullscreen: boolean;
  onToggle: () => void;
  className?: string;
}

const DEFAULT_CLS =
  'w-7 h-7 flex items-center justify-center rounded border border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary) transition-colors';

/** Кнопка входа/выхода из полноэкранного режима (вынесено из QuestStatusBar). */
export function FullscreenToggleButton({ isFullscreen, onToggle, className }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isFullscreen ? 'Выйти из полноэкранного (Esc)' : 'Полноэкранный режим'}
      className={className ?? DEFAULT_CLS}
    >
      {isFullscreen ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 1v3H1M8 1v3h3M11 8H8v3M1 8h3v3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
