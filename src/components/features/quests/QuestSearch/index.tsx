'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import type { TaskRaw } from '@/types/quest';
import { traderImg } from '@/lib/trader-utils';

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-blender-medium text-(--primary)">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

interface Props {
  tasks:      TaskRaw[];
  onFocus:    (task: TaskRaw) => void;
  anchorRef:  React.RefObject<HTMLDivElement | null>;
}

export function QuestSearch({ tasks, onFocus, anchorRef }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Вычисляем позицию от кнопки-якоря один раз при монтировании
  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 28, left: rect.left });
  }, [anchorRef]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = query.length >= 2
    ? tasks.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  // Ждём вычисления позиции
  if (!pos) return null;

  return (
    <div
      className="animate-quest-search fixed z-200"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Input 348×36px */}
      <div className="flex items-center gap-2 px-3 w-87 h-9 bg-(--color-darkbase) border border-(--primary) rounded-xs">
        <span className="icon-mask icon-eft-search-icon w-3.5 h-3.5 text-(--primary) shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Введите название задания..."
          className="bg-transparent outline-none w-full text-xs font-blender-book text-text-primary placeholder:text-text-secondary"
        />
      </div>

      {/* Results 348×348px — скрытый скролл */}
      {query.length >= 2 && (
        <div className="mt-2 w-87 h-87 bg-(--color-darkbase) border border-lines-hover rounded-xs overflow-y-auto scrollbar-hidden">
          {results.length === 0 ? (
            <div className="flex items-center px-3 h-9 text-xs text-text-secondary">
              Ничего не найдено
            </div>
          ) : (
            results.map(task => (
              <button
                key={task.id}
                onClick={() => onFocus(task)}
                className="flex items-center gap-2 px-3 w-full h-9 border-b border-lines-hover hover:bg-card-menu transition-colors text-left shrink-0"
              >
                <img
                  src={traderImg(task.trader.normalizedName)}
                  alt={task.trader.name}
                  width={20}
                  height={20}
                  className="rounded-xs shrink-0 opacity-70"
                />
                <span className="text-xs font-blender-book text-text-primary leading-tight truncate">
                  <HighlightedText text={task.name} query={query} />
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
