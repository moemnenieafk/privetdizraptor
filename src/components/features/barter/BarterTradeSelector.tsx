'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Search, X, Lock } from 'lucide-react';
import { useBarterStore } from '@/store/useBarterStore';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import type { BarterTrade } from '@/types/barter';

interface Props {
  allBarters: BarterTrade[];
}

export function BarterTradeSelector({ allBarters }: Props) {
  const selectedBarter = useBarterStore((s) => s.selectedBarter);
  const selectBarter = useBarterStore((s) => s.selectBarter);
  const clearBarter = useBarterStore((s) => s.clearBarter);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<BarterTrade[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!value.trim() || value.length < 2) {
          setResults([]);
          setIsOpen(false);
          return;
        }
        const q = value.toLowerCase();
        const filtered = allBarters
          .filter(
            (trade) =>
              trade.rewardItems.some(
                (ri) =>
                  ri.item.name.toLowerCase().includes(q) ||
                  ri.item.shortName.toLowerCase().includes(q)
              ) || trade.trader.name.toLowerCase().includes(q)
          )
          .slice(0, 10);
        setResults(filtered);
        setIsOpen(filtered.length > 0);
      }, 200);
    },
    [allBarters]
  );

  const handleSelect = (trade: BarterTrade) => {
    selectBarter(trade);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // ─── Selected state ─────────────────────────────────────────────
  if (selectedBarter) {
    const reward = selectedBarter.rewardItems[0];
    const rewardLabel = selectedBarter.rewardItems
      .map((ri) => `${ri.item.name}${ri.count > 1 ? ` ×${Math.ceil(ri.count)}` : ''}`)
      .join(' + ');

    return (
      <div className="flex items-center gap-2 w-full px-3 py-2 bg-card-menu border border-(--primary)">
        {reward && (
          <div
            className="relative shrink-0 w-8 h-8 border border-lines-hover"
            style={{ background: getTarkovBackgroundColor(reward.item.backgroundColor) }}
          >
            {reward.item.image512pxLink && (
              <Image
                src={reward.item.image512pxLink}
                alt={reward.item.shortName}
                fill
                className="object-contain p-0.5"
                sizes="32px"
                unoptimized
              />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
            {selectedBarter.trader.name} LL{selectedBarter.level}
            {selectedBarter.taskUnlock && (
              <span className="ml-2 text-moderate">· квест</span>
            )}
          </p>
          <p className="font-blender-medium text-sm text-text-primary truncate">{rewardLabel}</p>
        </div>
        <button
          type="button"
          onClick={clearBarter}
          className="shrink-0 flex items-center gap-1 px-2 py-1 font-blender-medium text-[10px] uppercase text-text-muted hover:text-failure transition-colors duration-150"
        >
          <X size={11} />
          Сброс
        </button>
      </div>
    );
  }

  // ─── Search state ────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search size={14} className="absolute left-3 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          placeholder="Выбрать бартерную сделку..."
          className="w-full pl-9 pr-3 py-2 bg-(--color-darkbase) border border-lines-hover text-text-primary font-blender-book text-sm placeholder:text-text-muted focus:outline-none focus:border-(--primary) transition-colors duration-150"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-px bg-(--color-darkbase) border border-lines-hover border-t-0 max-h-72 overflow-y-auto">
          {results.map((trade) => {
            const reward = trade.rewardItems[0];
            const rewardLabel = trade.rewardItems
              .map((ri) => `${ri.item.name}${ri.count > 1 ? ` ×${Math.ceil(ri.count)}` : ''}`)
              .join(' + ');
            return (
              <button
                key={trade.id}
                type="button"
                onClick={() => handleSelect(trade)}
                className="w-full flex items-center gap-2 px-2 py-2 hover:bg-card-menu transition-colors duration-100 text-left border-b border-lines-hover last:border-b-0"
              >
                {reward && (
                  <div
                    className="relative shrink-0 w-9 h-9 border border-lines-hover"
                    style={{ background: getTarkovBackgroundColor(reward.item.backgroundColor) }}
                  >
                    {reward.item.image512pxLink && (
                      <Image
                        src={reward.item.image512pxLink}
                        alt={reward.item.shortName}
                        fill
                        className="object-contain p-0.5"
                        sizes="36px"
                        unoptimized
                      />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-blender-medium text-[10px] uppercase text-text-muted">
                      {trade.trader.name} LL{trade.level}
                    </span>
                    {trade.taskUnlock && (
                      <Lock size={9} className="text-moderate shrink-0" />
                    )}
                  </div>
                  <p className="font-blender-book text-sm text-text-primary truncate">
                    {rewardLabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
