'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { useBarterStore } from '@/store/useBarterStore';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import type { BarterSearchResult } from '@/types/barter';

interface Props {
  allItems: BarterSearchResult[];
}

export function BarterSearchBar({ allItems }: Props) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<BarterSearchResult[]>([]);
  const addItem = useBarterStore((s) => s.addItem);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!value.trim()) {
          setResults([]);
          setIsOpen(false);
          return;
        }
        const q = value.toLowerCase();
        const filtered = allItems
          .filter(
            (item) =>
              item.name.toLowerCase().includes(q) ||
              item.shortName.toLowerCase().includes(q) ||
              item.normalizedName.toLowerCase().includes(q)
          )
          .slice(0, 12);
        setResults(filtered);
        setIsOpen(filtered.length > 0);
      }, 200);
    },
    [allItems]
  );

  const handleSelect = (item: BarterSearchResult) => {
    addItem(item);
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

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <div className="relative flex items-center">
        <Search
          size={14}
          className="absolute left-3 text-(--color-text-muted) pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          placeholder="Добавить предмет в схрон..."
          className="w-full pl-9 pr-3 py-2 bg-(--color-darkbase) border border-(--color-lines-hover) text-(--color-text-primary) font-blender-book text-sm placeholder:text-(--color-text-muted) focus:outline-none focus:border-(--primary) transition-colors duration-150"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-px bg-(--color-darkbase) border border-(--color-lines-hover) border-t-0 max-h-64 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-(--color-card-menu) transition-colors duration-100 text-left"
            >
              <div
                className="relative flex-shrink-0 w-9 h-9 border border-(--color-lines-hover)"
                style={{ background: getTarkovBackgroundColor(item.backgroundColor) }}
              >
                {item.image512pxLink && (
                  <Image
                    src={item.image512pxLink}
                    alt={item.shortName}
                    fill
                    className="object-contain p-[2px]"
                    sizes="36px"
                    unoptimized
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-blender-book text-sm text-(--color-text-primary) truncate">
                  {item.name}
                </p>
                <p className="font-blender-medium text-type-caption uppercase text-(--color-text-muted)">
                  {item.shortName} · {item.width}×{item.height}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
