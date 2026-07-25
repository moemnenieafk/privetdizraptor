'use client';

import { ARCADE_GAMES } from './registry';

interface GameSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

// Селектор автоматов. Адаптивная сетка (число колонок от ширины — 5vs4 в макете = артефакт).
// Тач-цели ≥44px. game02 — заблокированная карточка «Скоро».
export function GameSelector({ selectedId, onSelect }: GameSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
        Выбор автомата
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {ARCADE_GAMES.map((g) => {
          const soon = g.status === 'soon';
          const active = g.id === selectedId && !soon;
          return (
            <button
              key={g.id}
              type="button"
              disabled={soon}
              onClick={() => !soon && onSelect(g.id)}
              aria-pressed={active}
              className={`flex min-h-11 flex-col items-start gap-1 rounded-xs border p-3 text-left transition-colors ${
                active
                  ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                  : soon
                    ? 'border-lines-hover bg-card-menu opacity-55'
                    : 'border-lines-hover bg-card-menu hover:border-(--primary)'
              }`}
            >
              <span className="font-blender-medium text-xs uppercase leading-tight tracking-widest whitespace-pre-line text-text-primary">
                {g.logo}
              </span>
              <span className="line-clamp-2 text-type-micro font-blender-book text-text-secondary">
                {g.tagline}
              </span>
              <span
                className={`mt-auto font-blender-medium text-type-micro uppercase tracking-widest ${
                  active ? 'text-(--primary)' : 'text-text-muted'
                }`}
              >
                {soon ? 'Скоро' : active ? 'Идёт' : 'Выбрать'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
