'use client';

// Контролы списка крафтов «Что выгодно скрафтить»: поиск + чипы-фильтры + дропдаун сортировки.
// Презентационный — всё состояние держит родитель (T7), сюда приходит через пропсы/колбэки.
// Раскладка и стиль 1:1 с блоком контролов «Важных предметов» (NeededMergedClient): поиск
// flex-1, три FilterChip-тогла, поповер сортировки (right-0/z-30, клик-вне + Esc закрывают).
import { useEffect, useRef, useState } from 'react';
import { ArrowDownWideNarrow, Check, ChevronDown, LockOpen, Search, TrendingUp } from 'lucide-react';

/** Метод сортировки списка крафтов. Порядок в SORT_OPTIONS = порядок в меню. */
export type CraftSortMode = 'pph' | 'profit' | 'roi' | 'duration' | 'cost' | 'alpha';

const SORT_OPTIONS: { key: CraftSortMode; label: string }[] = [
  { key: 'pph', label: '₽/час' },
  { key: 'profit', label: 'Прибыль ₽' },
  { key: 'roi', label: 'ROI %' },
  { key: 'duration', label: 'Время (короче)' },
  { key: 'cost', label: 'Дешевле вход' },
  { key: 'alpha', label: 'Алфавит' },
];

interface CraftControlsProps {
  search: string;
  onSearch: (v: string) => void;
  onlyProfitable: boolean;
  onToggleProfitable: () => void;
  onlyAvailable: boolean;
  onToggleAvailable: () => void;
  hideLocked: boolean;
  onToggleHideLocked: () => void;
  sort: CraftSortMode;
  onSort: (m: CraftSortMode) => void;
}

/** Кнопка-фильтр списка (тоггл). lucide-нода + подпись; активна — рамка/фон primary. */
function FilterChip({
  on,
  onClick,
  lucide,
  children,
}: {
  on: boolean;
  onClick: () => void;
  lucide: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border px-3 font-blender-medium text-type-micro uppercase tracking-wider transition-colors ${
        on ? 'border-(--primary) bg-(--primary)/15 text-(--primary)' : 'border-lines-hover text-text-muted hover:text-text-secondary'
      }`}
    >
      {lucide}
      {children}
    </button>
  );
}

export function CraftControls({
  search,
  onSearch,
  onlyProfitable,
  onToggleProfitable,
  onlyAvailable,
  onToggleAvailable,
  hideLocked,
  onToggleHideLocked,
  sort,
  onSort,
}: CraftControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Меню сортировки: закрытие по клику-вне и Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-2">
      <div className="relative w-full sm:min-w-40 sm:flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Что скрафтить…"
          className="h-9 w-full rounded-sm border border-lines-hover bg-(--color-base) pl-10 pr-4 font-blender-book text-type-caption text-text-primary placeholder:text-text-muted focus:border-(--primary) focus:outline-none"
        />
      </div>

      <FilterChip on={onlyProfitable} onClick={onToggleProfitable} lucide={<TrendingUp className="h-3.5 w-3.5" aria-hidden />}>
        Только прибыльные
      </FilterChip>
      <FilterChip on={onlyAvailable} onClick={onToggleAvailable} lucide={<Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}>
        Доступно сейчас
      </FilterChip>
      <FilterChip on={hideLocked} onClick={onToggleHideLocked} lucide={<LockOpen className="h-3.5 w-3.5" aria-hidden />}>
        Скрыть заблокированные
      </FilterChip>

      {/* Дропдаун сортировки */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          className={`flex h-9 items-center gap-2 rounded-sm border px-3 font-blender-medium text-type-micro uppercase tracking-wider transition-colors ${
            menuOpen ? 'border-(--primary) text-(--primary)' : 'border-lines-hover text-text-muted hover:text-text-secondary'
          }`}
        >
          <ArrowDownWideNarrow className="h-4 w-4 shrink-0" aria-hidden />
          Сортировка
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 rounded-md border border-lines-hover bg-(--color-base) p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            {SORT_OPTIONS.map((o) => {
              const active = sort === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => {
                    onSort(o.key);
                    setMenuOpen(false);
                  }}
                  className={`flex h-8 w-full items-center justify-between rounded-sm px-2.5 font-blender-medium text-type-caption transition-colors ${
                    active ? 'bg-(--primary)/15 text-(--primary)' : 'text-text-secondary hover:bg-lines-hover/40'
                  }`}
                >
                  {o.label}
                  {active && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
