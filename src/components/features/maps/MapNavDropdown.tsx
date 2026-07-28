'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Users } from 'lucide-react';
import { mapIconClass, mapOrderIndex } from '@/data/map-icons';

export interface NavMapItem {
  slug: string;
  name: string;
  players: string | null;
  raidDuration: number | null;
}

function RaidMeta({ players, duration }: { players: string | null; duration: number | null }) {
  if (!players && duration == null) return null;
  return (
    <span className="flex shrink-0 items-center gap-3 font-blender-book text-type-caption text-text-secondary">
      {players && (
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> {players} игроков
        </span>
      )}
      {duration != null && (
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> {duration} мин
        </span>
      )}
    </span>
  );
}

interface Props {
  maps: NavMapItem[];
  activeSlug: string;
  activeName: string;
  activePlayers: string | null;
  activeRaidDuration: number | null;
}

/**
 * Выпадашка выбора карты (замена MapNavStrip). Триггер = текущая карта (иконка+имя+игроки+
 * время+▼); клик раскрывает список всех карт (data-driven navMaps), выбор ведёт на карту.
 * Панель — `fixed` по rect триггера (бар = overflow-x-auto, иначе клипует), паттерн как у MapSearch.
 */
export function MapNavDropdown({ maps, activeSlug, activeName, activePlayers, activeRaidDuration }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const sorted = [...maps].sort((a, b) => mapOrderIndex(a.slug) - mapOrderIndex(b.slug));

  useLayoutEffect(() => {
    if (!open) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (slug: string) => {
    setOpen(false);
    if (slug !== activeSlug) router.push(`/eft/maps/${slug}`);
  };

  const activeIcon = mapIconClass(activeSlug);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`pointer-events-auto flex h-14 w-134 items-center gap-4 rounded-t-none rounded-b-lg border px-7 transition-colors ${
          open ? 'border-(--primary)/40 bg-card-menu' : 'border-lines-hover bg-card-menu hover:border-(--primary)/40'
        }`}
      >
        {activeIcon ? <span className={`icon-mask ${activeIcon} h-7 w-7 shrink-0 text-text-primary`} /> : null}
        <span className="whitespace-nowrap font-blender-medium text-lg uppercase leading-none tracking-widest text-text-primary">
          {activeName}
        </span>
        <span className="flex-1" />
        <RaidMeta players={activePlayers} duration={activeRaidDuration} />
      </button>

      {open && pos && (
        <div
          className="pointer-events-auto fixed z-[560] max-h-[70vh] w-134 -translate-x-1/2 overflow-y-auto scrollbar-compact rounded-sm border border-lines-hover bg-(--color-base)/95 py-1 shadow-lg backdrop-blur-md"
          style={{ top: pos.top, left: pos.left }}
        >
          {sorted.map((m) => {
            const icon = mapIconClass(m.slug);
            const active = m.slug === activeSlug;
            return (
              <button
                key={m.slug}
                type="button"
                onClick={() => go(m.slug)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  active ? 'bg-(--primary)/15' : 'hover:bg-card-menu'
                }`}
              >
                {icon ? (
                  <span className={`icon-mask ${icon} h-7 w-7 shrink-0 ${active ? 'text-(--primary)' : 'text-text-secondary'}`} />
                ) : (
                  <span className="h-7 w-7 shrink-0" />
                )}
                <span
                  className={`flex-1 whitespace-nowrap font-blender-medium text-sm uppercase tracking-widest ${
                    active ? 'text-(--primary)' : 'text-text-secondary'
                  }`}
                >
                  {m.name}
                </span>
                <RaidMeta players={m.players} duration={m.raidDuration} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
