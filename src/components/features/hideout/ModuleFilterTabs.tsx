'use client';

// Фильтр-вкладки модулей одной строкой (T4 craft-profit-rework). Презентационная плитка
// в стиле /modules (HideoutBuildTracker moduleTiles): иконка станции 28px + уровень «0N» +
// «рецептов доступно/всего». Первая вкладка «Все» (сумма). Одиночный выбор, клик по активной
// снимает фильтр (onSelect(null)). Состояние держит родитель (T7) — стор тут не читаем.
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
  totalAll: number; // для вкладки «Все»
  active: string | null; // null = «Все»
  onSelect: (key: string | null) => void;
}

export function ModuleFilterTabs({ tabs, totalAll, active, onSelect }: ModuleFilterTabsProps) {
  return (
    <div className="flex w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--color-lines-hover)_55%,transparent)_transparent]">
      {/* «Все» — сумма всех рецептов, активна когда фильтр снят (active === null). */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        title="Все модули"
        className={`flex min-h-20 min-w-24 flex-1 flex-col items-center justify-center gap-1 rounded-xs border p-2 transition-all ${
          active === null
            ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
            : 'border-lines-hover bg-(--color-base) hover:brightness-110'
        }`}
      >
        <span
          className={`font-blender-medium text-[22px] leading-none tabular-nums ${
            active === null ? 'text-(--primary)' : 'text-text-secondary'
          }`}
        >
          {totalAll}
        </span>
        <span
          className={`font-blender-medium text-type-micro uppercase tracking-widest ${
            active === null ? 'text-(--primary)' : 'text-text-secondary'
          }`}
        >
          Все
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
            // Клик по активной снимает фильтр; иначе выбирает станцию (одиночный выбор).
            onClick={() => onSelect(isActive ? null : t.key)}
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
