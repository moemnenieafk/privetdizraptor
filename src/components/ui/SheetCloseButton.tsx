interface Props {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Красный крестик закрытия для мобильных шитов/drawer'ов карты (по макету Figma — тот же паттерн,
 * что у детали квеста): тёмно-красный бокс `bg-danger-dim` + светлый глиф `icon-eft-profile-btn-close`.
 * Тап-таргет 36px, видимый бокс 24px.
 */
export function SheetCloseButton({ onClick, className, ariaLabel = 'Закрыть' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex size-9 shrink-0 items-center justify-center transition-opacity hover:opacity-80 ${className ?? ''}`}
    >
      <span className="flex size-6 items-center justify-center rounded bg-danger-dim">
        <span className="icon-mask icon-eft-profile-btn-close size-3 text-text-primary" />
      </span>
    </button>
  );
}
