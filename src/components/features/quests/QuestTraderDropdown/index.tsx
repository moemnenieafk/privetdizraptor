'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TraderOpt {
  normalizedName: string;
  name: string;
}

interface Props {
  traders: TraderOpt[];
  /** УЛ игрока по торговцу (normalizedName → 1..4). */
  traderLevels: Record<string, number>;
  /** Текущий торговец (normalizedName) или null = «Все торговцы». */
  selected: string | null;
  onSelect: (name: string | null) => void;
}

const traderImg = (n: string) => `/images/traders/eft/${n}.webp`;
const clampLevel = (l?: number) => Math.min(4, Math.max(1, l ?? 1));

/**
 * Трейдер-пилюля + дропдаун для карты заданий (замена ряда из 11 портретов). Триггер = текущий
 * торговец (портрет + имя + твой УЛ) либо «Все»; клик раскрывает список 11 торговцев + пункт «Все».
 * Позиционирование панели — паттерн `MapNavDropdown` (fixed по rect триггера, click-outside/Escape).
 */
export function QuestTraderDropdown({ traders, traderLevels, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (name: string | null) => { setOpen(false); onSelect(name); };
  const cur = traders.find((t) => t.normalizedName === selected) ?? null;
  const curLvl = cur ? clampLevel(traderLevels[cur.normalizedName]) : 1;

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
        {cur ? (
          <img src={traderImg(cur.normalizedName)} alt={cur.name} width={40} height={40} className="h-10 w-10 shrink-0 rounded object-cover object-top" />
        ) : (
          <span className="icon-mask icon-eft-lore-traders h-9 w-9 shrink-0 text-text-primary" />
        )}
        <span className="whitespace-nowrap font-blender-medium text-lg uppercase leading-none tracking-widest text-text-primary">
          {cur ? cur.name : 'Все торговцы'}
        </span>
        <span className="flex-1" />
        {cur && (
          <span className="flex shrink-0 items-center gap-2">
            <span className="font-blender-book text-type-caption uppercase tracking-widest text-text-muted">Ваш уровень лояльности</span>
            <span className={`icon-mask icon-eft-profile-rep-${curLvl} h-6 w-6 text-(--primary)`} />
          </span>
        )}
      </button>

      {open && pos && (
        <div
          className="pointer-events-auto fixed z-[560] max-h-[70vh] w-134 -translate-x-1/2 overflow-y-auto scrollbar-compact rounded-sm border border-lines-hover bg-(--color-base)/95 py-1 shadow-lg backdrop-blur-md"
          style={{ top: pos.top, left: pos.left }}
        >
          <button
            type="button"
            onClick={() => pick(null)}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${selected === null ? 'bg-(--primary)/15' : 'hover:bg-card-menu'}`}
          >
            <span className={`icon-mask icon-eft-lore-traders h-9 w-9 shrink-0 ${selected === null ? 'text-(--primary)' : 'text-text-secondary'}`} />
            <span className={`flex-1 font-blender-medium text-sm uppercase tracking-widest ${selected === null ? 'text-(--primary)' : 'text-text-secondary'}`}>Все торговцы</span>
          </button>
          {traders.map((t) => {
            const active = t.normalizedName === selected;
            const lvl = clampLevel(traderLevels[t.normalizedName]);
            return (
              <button
                key={t.normalizedName}
                type="button"
                onClick={() => pick(t.normalizedName)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-(--primary)/15' : 'hover:bg-card-menu'}`}
              >
                <img src={traderImg(t.normalizedName)} alt={t.name} width={36} height={36} className="h-9 w-9 shrink-0 rounded object-cover object-top" />
                <span className={`flex-1 whitespace-nowrap font-blender-medium text-sm uppercase tracking-widest ${active ? 'text-(--primary)' : 'text-text-secondary'}`}>{t.name}</span>
                <span className="flex shrink-0 items-center gap-2 font-blender-book text-type-caption uppercase tracking-widest text-text-muted">
                  Ваш УЛ <span className={`icon-mask icon-eft-profile-rep-${lvl} h-5 w-5 ${active ? 'text-(--primary)' : 'text-text-secondary'}`} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
