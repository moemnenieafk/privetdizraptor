'use client';

import { useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useMapUiStore } from '@/store/useMapUiStore';

export type MapSearchKind = 'marker' | 'quest' | 'extract';

export interface MapSearchResult {
  id: string;
  label: string;
  kind: MapSearchKind;
  icon?: ReactNode;
}

interface MapSearchSheetProps {
  results: MapSearchResult[];
  loading?: boolean;
  onQueryChange: (q: string) => void;
  onResultClick: (r: MapSearchResult) => void;
}

const KIND_LABEL: Record<MapSearchKind, string> = {
  marker: 'Маркер',
  quest: 'Квест',
  extract: 'Выход',
};

export function MapSearchSheet({ results, loading, onQueryChange, onResultClick }: MapSearchSheetProps) {
  const open = useMapUiStore((s) => s.activeSheet === 'search');
  const close = useMapUiStore((s) => s.closeSheet);
  const [q, setQ] = useState('');

  return (
    <BottomSheet open={open} title="Поиск" onClose={close}>
      <div className="relative mb-3">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-secondary" strokeWidth={2} />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onQueryChange(e.target.value);
          }}
          placeholder="Маркеры, выходы..."
          className="h-11 w-full rounded-xs border border-lines-hover bg-card-menu pr-3 pl-9 font-blender-book text-sm text-text-primary placeholder:text-text-muted"
        />
      </div>

      {loading ? (
        <ul className="flex flex-col gap-1">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-12 w-full animate-pulse rounded-xs bg-card-menu" />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1 pb-2">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => {
                  onResultClick(r);
                  close();
                }}
                className="flex h-12 w-full items-center gap-3 rounded-xs border border-lines-hover bg-card-menu px-3"
              >
                {r.icon && <span className="flex size-6 shrink-0 items-center justify-center text-text-secondary">{r.icon}</span>}
                <span className="flex-1 truncate text-left font-blender-book text-sm text-text-primary">{r.label}</span>
                <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">{KIND_LABEL[r.kind]}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && q.trim() !== '' && (
            <li className="py-6 text-center font-blender-book text-sm text-text-muted">Ничего не найдено</li>
          )}
        </ul>
      )}
    </BottomSheet>
  );
}