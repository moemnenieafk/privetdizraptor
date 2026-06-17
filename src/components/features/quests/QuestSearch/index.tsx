'use client';

import { useState, useRef, useEffect } from 'react';
import type { TaskRaw } from '@/types/quest';

const TRADER_SLUG: Record<string, string> = { 'btr-driver': 'btrdriver' };
const traderImg = (n: string) => `/images/traders/eft/${TRADER_SLUG[n] ?? n}.webp`;

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
  tasks: TaskRaw[];
  isOpen: boolean;
  onClose: () => void;
  onFocusNode: (task: TaskRaw) => void;
}

export function QuestSearch({ tasks, isOpen, onClose, onFocusNode }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const results = query.length >= 2
    ? tasks.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="absolute top-0 left-0 z-50 w-72">
      <div className="relative">
        <span className="icon-bg icon-eft-search absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Поиск квеста..."
          className="w-full h-8 pl-7 pr-3 bg-card-menu border-b border-lines-hover text-[11px] font-blender-book text-text-primary placeholder:text-text-muted outline-none focus:border-(--primary)/60 transition-colors"
        />
      </div>

      {results.length > 0 && (
        <div className="bg-card-menu border-x border-b border-lines-hover shadow-xl max-h-64 overflow-y-auto">
          {results.map((task) => (
            <button
              key={task.id}
              onClick={() => { onFocusNode(task); onClose(); }}
              className="w-full flex items-center gap-2 px-3 py-2 border-b border-lines-hover/50 last:border-0 hover:bg-lines-hover/40 transition-colors text-left"
            >
              <img
                src={traderImg(task.trader.normalizedName)}
                alt={task.trader.name}
                width={14}
                height={14}
                className="rounded-xs shrink-0 opacity-70"
              />
              <span className="text-[11px] font-blender-book text-text-primary truncate">
                <HighlightedText text={task.name} query={query} />
              </span>
            </button>
          ))}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && (
        <div className="bg-card-menu border-x border-b border-lines-hover px-3 py-2.5">
          <span className="text-[10px] font-blender-medium uppercase text-text-muted">Квест не найден</span>
        </div>
      )}
    </div>
  );
}
