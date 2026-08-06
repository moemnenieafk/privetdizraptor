'use client';

const TIERS = [1, 2, 3, 4] as const;

interface Props {
  /** Включённые УЛ (видимые полки). */
  enabled: Set<number>;
  onToggle: (tier: number) => void;
}

/**
 * УЛ-тоглы I/II/III/IV — независимые переключатели видимости полок лояльности на карте
 * заданий. По умолчанию все включены; выключить последний нельзя (min 1). Иконки — те же
 * `icon-eft-profile-rep-{tier}`, что и в заголовках полок.
 */
export function QuestTierToggles({ enabled, onToggle }: Props) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Фильтр по уровням лояльности">
      {TIERS.map((tier) => {
        const on = enabled.has(tier);
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onToggle(tier)}
            title={`Уровень лояльности ${tier}`}
            aria-pressed={on}
            className={`flex h-8 w-8 items-center justify-center rounded border transition-colors duration-150 ${
              on
                ? 'border-(--primary)/40 bg-(--primary)/15 text-(--primary)'
                : 'border-lines-hover text-text-muted hover:border-(--primary)/40 hover:text-(--primary)'
            }`}
          >
            <span className={`icon-mask icon-eft-profile-rep-${tier} h-5 w-5`} />
          </button>
        );
      })}
    </div>
  );
}
