'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useQuestMapUiStore } from '@/store/useQuestMapUiStore';
import type { TaskRaw } from '@/types/quest';

interface Props {
  tasks: TaskRaw[];
  /** Перелёт к ноде квеста на карте. */
  onFocus: (task: TaskRaw) => void;
}

/**
 * Шит поиска квеста (mobile). Тап по результату — перелёт к ноде квеста, шит закрывается.
 */
export function QuestSearchSheet({ tasks, onFocus }: Props) {
  const open = useQuestMapUiStore((s) => s.activeSheet === 'search');
  const close = useQuestMapUiStore((s) => s.closeSheet);
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return tasks.filter((t) => t.name.toLowerCase().includes(query)).slice(0, 40);
  }, [q, tasks]);

  return (
    <BottomSheet open={open} title="Поиск квеста" onClose={close}>
      <div className="relative mb-3">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-secondary" strokeWidth={2} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Название квеста..."
          className="h-11 w-full rounded-xs border border-lines-hover bg-card-menu pr-3 pl-9 font-blender-book text-sm text-text-primary placeholder:text-text-muted"
        />
      </div>

      <ul className="flex flex-col gap-1 pb-2">
        {results.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => {
                onFocus(t);
                close();
              }}
              className="flex h-12 w-full items-center gap-3 rounded-xs border border-lines-hover bg-card-menu px-3"
            >
              <img
                src={`/images/traders/eft/${t.trader.normalizedName}.webp`}
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-xs object-cover object-top"
              />
              <span className="min-w-0 flex-1 truncate text-left font-blender-book text-sm text-text-primary">{t.name}</span>
            </button>
          </li>
        ))}
        {results.length === 0 && q.trim() !== '' && (
          <li className="py-6 text-center font-blender-book text-sm text-text-muted">Ничего не найдено</li>
        )}
      </ul>
    </BottomSheet>
  );
}