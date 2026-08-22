'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Search, Plus } from 'lucide-react';
import { searchEftItemsAction } from '@/actions/search-actions';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import type { SearchItemResult } from '@/types/search';

/**
 * Поиск предмета зеркала EFT + добавление в схрон.
 * Дебаунс ~300ms → searchEftItemsAction (читает нашу Supabase, §4.11).
 * Выбор строки фиксирует предмет; «Добавить» доступна только после выбора.
 */
export function StashAddSearch({ onAdd }: { onAdd: (inGameId: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItemResult[]>([]);
  const [selected, setSelected] = useState<SearchItemResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Дебаунс поиска — сеть только при query>=2 и без зафиксированного выбора.
  useEffect(() => {
    if (selected) return; // текст равен имени выбранного — не ищем
    const q = query.trim();
    if (q.length < 2) {
      const clear = setTimeout(() => setResults([]), 0);
      return () => clearTimeout(clear);
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await searchEftItemsAction(q);
          setResults(res);
          setIsOpen(true);
        } catch {
          setResults([]);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selected]);

  // Клик вне — закрыть дропдаун.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const pick = (item: SearchItemResult) => {
    setSelected(item);
    setQuery(item.name);
    setResults([]);
    setIsOpen(false);
  };

  const handleAdd = () => {
    if (!selected) return;
    onAdd(selected.id);
    setSelected(null);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={rootRef}>
      <div className="flex items-center gap-2">
        {/* Инпут поиска */}
        <div className="group relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lines-hover transition-colors group-focus-within:text-(--primary)" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null); // ввод сбрасывает выбор → «Добавить» гаснет
            }}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            placeholder="Найти предмет…"
            className="h-10 w-full rounded border border-lines-hover bg-black/20 pl-9 pr-3 font-blender-book text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-(--primary)"
          />
        </div>

        {/* Кнопка добавления */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={!selected}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded border border-lines-hover bg-card-menu px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-lines-hover disabled:hover:text-text-secondary"
        >
          <Plus className="h-4 w-4" />
          Добавить
        </button>
      </div>

      {/* Дропдаун результатов */}
      {isOpen && (results.length > 0 || isPending) && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-80 w-full overflow-y-auto rounded border border-lines-hover bg-card-menu/95 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          {isPending && results.length === 0 ? (
            // Лёгкий скелетон-список (§4.8)
            <ul className="p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-2 py-2">
                  <div className="h-10 w-10 shrink-0 rounded-xs bg-lines-hover/40 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-1/2 rounded-xs bg-lines-hover/50 animate-pulse" />
                    <div className="h-2 w-1/4 rounded-xs bg-lines-hover/30 animate-pulse" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="p-1">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item)}
                    className="flex w-full items-center gap-3 rounded-xs px-2 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xs border border-lines-hover"
                      style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
                    >
                      <img
                        src={itemIconUrl(item.id)}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-blender-medium text-sm text-text-primary">
                        {item.name}
                      </span>
                      <span className="block truncate font-blender-book text-xs text-text-muted">
                        {item.shortName}
                      </span>
                    </span>
                    <span className="shrink-0 font-blender-medium text-xs text-text-secondary">
                      {item.width}×{item.height}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
