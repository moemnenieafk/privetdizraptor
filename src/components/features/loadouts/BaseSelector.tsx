'use client';

// Выбор ствола-базы. 168 позиций — на телефоне без поиска это мучение, поэтому
// поиск и фильтр по калибру. Карточка ведёт на /add?base=<id>: контекст сборки
// считает сервер, клиент не тянет 2400 модулей ради списка.
//
// Картинка — рендер дефолт-пресета (ствол с обвесом «из коробки»), а не голая база:
// у пресета свой item id и своя отрендеренная иконка в R2. См. imageItemId.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { itemIconUrl } from '@/lib/item-icon';
import type { WeaponBaseListItem } from '@/db/weapons';

interface BaseSelectorProps {
  bases: WeaponBaseListItem[];
}

export function BaseSelector({ bases }: BaseSelectorProps) {
  const [query, setQuery] = useState('');
  const [caliber, setCaliber] = useState<string | null>(null);

  const calibers = useMemo(() => {
    const set = new Set<string>();
    for (const b of bases) if (b.caliber) set.add(b.caliber);
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [bases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bases.filter((b) => {
      if (caliber && b.caliber !== caliber) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) || b.shortName.toLowerCase().includes(q)
      );
    });
  }, [bases, query, caliber]);

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Поиск */}
      <div className="relative w-full">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию…"
          className="h-11 w-full rounded-sm border border-lines-hover bg-(--color-darkbase) pl-10 pr-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
        />
      </div>

      {/* Калибры — сетка в несколько строк, без горизонтальной прокрутки */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCaliber(null)}
          className={`h-9 shrink-0 rounded-xs border px-3 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
            caliber === null
              ? 'border-(--primary) text-(--primary)'
              : 'border-lines-hover text-text-secondary hover:border-(--primary)'
          }`}
        >
          Все
        </button>
        {calibers.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCaliber(c === caliber ? null : c)}
            className={`h-9 shrink-0 rounded-xs border px-3 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
              caliber === c
                ? 'border-(--primary) text-(--primary)'
                : 'border-lines-hover text-text-secondary hover:border-(--primary)'
            }`}
          >
            {c.replace('Caliber', '')}
          </button>
        ))}
      </div>

      <p className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
        {filtered.length} из {bases.length}
      </p>

      {/* Сетка стволов */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center font-blender-book text-sm text-text-secondary">
          Ничего не нашлось. Попробуйте другое название или сбросьте калибр.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <Link
              key={b.id}
              href={`/eft/progress/loadouts/add?base=${b.id}`}
              className="group flex min-h-22 items-center gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-3 transition-colors hover:border-(--primary)"
            >
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xs bg-(--color-darkbase)">
                <img
                  src={itemIconUrl(b.imageItemId)}
                  alt={b.name}
                  loading="lazy"
                  className="h-full w-full object-contain p-1"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-blender-book text-sm text-text-primary group-hover:text-(--primary)">
                  {b.name}
                </span>
                <div className="flex gap-3 font-blender-medium text-xs text-text-secondary">
                  <span>ЭРГО {b.ergonomics}</span>
                  <span>ОТДАЧА {b.recoilSum}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}