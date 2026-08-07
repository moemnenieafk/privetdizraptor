'use client';

const TIERS = [1, 2, 3, 4] as const;

interface Props {
  /** Включённые УЛ (видимые полки). */
  enabled: Set<number>;
  onToggle: (tier: number) => void;
  /** ПКМ по табу — навести камеру на ряд квестов этого УЛ (fit только его ноды). */
  onFocusTier?: (tier: number) => void;
  /** Раскладка: горизонталь (десктоп, дефолт) или вертикаль (мобилка — полоса у левого края канваса). */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * УЛ-тоглы I/II/III/IV — независимые переключатели видимости полок лояльности на карте
 * заданий. По умолчанию все включены; выключить последний нельзя (min 1). Иконки — те же
 * `icon-eft-profile-rep-{tier}`, что и в заголовках полок.
 */
export function QuestTierToggles({ enabled, onToggle, onFocusTier, orientation = 'horizontal' }: Props) {
  return (
    <div
      className={`flex items-center gap-1.5 ${orientation === 'vertical' ? 'flex-col' : ''}`}
      role="group"
      aria-label="Фильтр по уровням лояльности"
    >
      {TIERS.map((tier) => {
        const on = enabled.has(tier);
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onToggle(tier)}
            onContextMenu={(e) => { e.preventDefault(); onFocusTier?.(tier); }}
            title={`Уровень лояльности ${tier} — ПКМ: весь ряд в кадр`}
            aria-pressed={on}
            className={`flex h-9 w-9 items-center justify-center transition-colors duration-150 ${
              on ? 'text-(--primary)/50 hover:text-(--primary)' : 'text-text-muted hover:text-(--primary)/50'
            }`}
          >
            <span className={`icon-mask icon-eft-profile-rep-${tier} h-5 w-5`} />
          </button>
        );
      })}
    </div>
  );
}
