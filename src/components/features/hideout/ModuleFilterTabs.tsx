'use client';

// Фильтр-вкладки модулей одной строкой (T4 craft-profit-rework, T8: «ТОП» вместо «Все»).
// Презентационная плитка в стиле /modules (HideoutBuildTracker moduleTiles): иконка станции 28px +
// уровень «0N» + «рецептов доступно/всего». Первая вкладка «ТОП» (profit-icon + счётчик прибыльных).
// Одиночный выбор, клик по активной станции → возврат на «ТОП» (onSelect('top')). Состояние держит
// родитель (T7) — стор тут не читаем.
import { stationIconClass } from '@/components/features/hideout/HideoutBuildTracker';

export interface ModuleTabDatum {
  key: string; // stationNormalized
  name: string;
  normalizedName: string; // для stationIconClass
  builtLevel: number; // из useHideoutStore+editionFloor (даёт T7)
  availCount: number; // рецептов доступно на текущем уровне
  totalCount: number; // всего рецептов станции
}

export interface ModuleFilterTabsProps {
  tabs: ModuleTabDatum[]; // отсортированы родителем
  topCount: number; // число прибыльных крафтов — для вкладки «ТОП»
  active: string; // 'top' = «ТОП», иначе stationKey
  onSelect: (key: string) => void;
}

export function ModuleFilterTabs({ tabs, topCount, active, onSelect }: ModuleFilterTabsProps) {
  const topActive = active === 'top';
  return (
    <div className="flex w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--color-lines-hover)_55%,transparent)_transparent]">
      {/* «ТОП» — прибыльные крафты по всем станциям, дефолт-вкладка (active === 'top'). */}
      <button
        type="button"
        onClick={() => onSelect('top')}
        title="Прибыльные крафты по всем модулям"
        className={`flex min-h-20 min-w-24 flex-1 flex-col items-center justify-center gap-1 rounded-xs border p-2 transition-all ${
          topActive
            ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
            : 'border-lines-hover bg-(--color-base) hover:brightness-110'
        }`}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-7 w-7 shrink-0 icon-mask icon-eft-profit bg-(--primary)" />
          <span
            className={`font-blender-medium text-[22px] leading-none tabular-nums ${
              topActive ? 'text-(--primary)' : 'text-text-secondary'
            }`}
          >
            {topCount}
          </span>
        </span>
        <span
          className={`font-blender-medium text-type-micro uppercase tracking-widest ${
            topActive ? 'text-(--primary)' : 'text-text-secondary'
          }`}
        >
          Топ
        </span>
      </button>

      {tabs.map((t) => {
        const isActive = active === t.key;
        const built = t.builtLevel > 0;
        // Тон иконки/уровня по состоянию: активна → primary, построена → text, иначе muted.
        const iconTone = isActive ? 'bg-(--primary)' : built ? 'bg-text-primary' : 'bg-text-muted';
        const lvlTone = isActive ? 'text-(--primary)' : built ? 'text-text-primary' : 'text-text-muted';
        return (
          <button
            key={t.key}
            type="button"
            // Клик по активной станции → возврат на «ТОП»; иначе выбирает станцию (одиночный выбор).
            onClick={() => onSelect(isActive ? 'top' : t.key)}
            title={`${t.name} — рецептов ${t.availCount} / ${t.totalCount}`}
            className={`flex min-h-20 min-w-24 flex-1 flex-col items-center justify-center gap-1 rounded-xs border p-2 transition-all ${
              isActive
                ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
                : 'border-lines-hover bg-(--color-base) hover:brightness-110'
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={`h-7 w-7 shrink-0 icon-mask ${stationIconClass(t.normalizedName)} ${iconTone}`}
              />
              <span className={`font-blender-medium text-[22px] leading-none tabular-nums ${lvlTone}`}>
                {String(t.builtLevel).padStart(2, '0')}
              </span>
            </span>
            <span
              className={`line-clamp-1 w-full text-center font-blender-medium text-type-micro uppercase tracking-wide ${
                isActive ? 'text-(--primary)' : 'text-text-secondary'
              }`}
            >
              {t.name}
            </span>
            <span
              className={`line-clamp-1 w-full text-center font-blender-medium text-type-micro tabular-nums tracking-wide ${
                isActive ? 'text-(--primary)' : 'text-text-muted'
              }`}
            >
              рецептов {t.availCount} / {t.totalCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
