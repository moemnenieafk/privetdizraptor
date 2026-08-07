'use client';

import { useEffect, useRef, useState } from 'react';
import { traderImg } from '@/lib/trader-utils';

interface TraderOpt { normalizedName: string; name: string }

interface Props {
  /** Путь-фильтры (как десктоп): тоглы куллинга по Каппе / Смотрителю. */
  filterKappa: boolean;
  filterLK: boolean;
  onKappa: () => void;
  onLK: () => void;
  /** Трейдер-селектор (пилюля → дропдаун). */
  traders: TraderOpt[];
  traderLevels: Record<string, number>;
  selectedTrader: string | null; // normalizedName или null = «Все»
  onSelectTrader: (name: string | null) => void;
}

const clampLevel = (l?: number) => Math.min(4, Math.max(1, l ?? 1));

/**
 * Верхний ряд-фильтров мобильной карты заданий (Figma Q1, mobile-only): по краям —
 * иконки-тоглы Каппа (золото) и Смотритель (зелёный), по центру — трейдер-пилюля
 * (портрет + имя + УЛ-бейдж), тап открывает дропдаун торговцев со скрытым скроллом.
 * Каппа/Смотритель — путь-фильтры как на десктопе, без процентов.
 */
export function MobileQuestBar({
  filterKappa, filterLK, onKappa, onLK,
  traders, traderLevels, selectedTrader, onSelectTrader,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const cur = traders.find((t) => t.normalizedName === selectedTrader) ?? null;
  const curLvl = cur ? clampLevel(traderLevels[cur.normalizedName]) : 1;
  const pick = (name: string | null) => { setOpen(false); onSelectTrader(name); };

  // Квадрат-тоггл пути (Каппа/Смотритель): активный = залит цветом, иначе рамка+иконка в цвет.
  const pathBtn = (active: boolean, color: string, icon: string, label: string, on: () => void) => (
    <button
      onClick={on}
      title={label}
      aria-pressed={active}
      className="flex size-7 shrink-0 items-center justify-center rounded border transition-colors"
      style={active
        ? { borderColor: color, backgroundColor: color, color: 'var(--color-darkbase)' }
        : { borderColor: color, color }}
    >
      <span className={`icon-mask ${icon} size-4`} style={active ? { backgroundColor: 'var(--color-darkbase)' } : undefined} />
    </button>
  );

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 px-3 lg:hidden">
      {pathBtn(filterKappa, 'var(--color-kappa)', 'icon-eft-profile-kappa', 'Путь Каппы', onKappa)}

      {/* Трейдер-пилюля + дропдаун. self-stretch + h-full: контейнер прижат к верхней
          линии shell и тянется на всю высоту ряда; верх прямой, низ — скруглён 4px. */}
      <div ref={rootRef} className="relative flex-1 min-w-0 self-stretch">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex h-full w-full items-center gap-2 rounded-b-sm border px-2.5 transition-colors ${
            open ? 'border-(--primary)/50' : 'border-lines-hover'
          }`}
        >
          {cur ? (
            <img src={traderImg(cur.normalizedName)} alt="" width={24} height={24} className="size-6 shrink-0 rounded-xs object-cover object-top" />
          ) : (
            <span className="icon-mask icon-eft-lore-traders size-5 shrink-0 text-text-primary" />
          )}
          <span className="min-w-0 flex-1 truncate text-left font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            {cur ? cur.name : 'Все торговцы'}
          </span>
          {cur && <span className={`icon-mask icon-eft-profile-rep-${curLvl} size-5 shrink-0 text-text-primary`} />}
        </button>

        {open && (
          <div className="absolute inset-x-0 top-full z-[560] mt-1 max-h-[60svh] overflow-y-auto scrollbar-hidden rounded-sm border border-lines-hover py-1 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={() => pick(null)}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${selectedTrader === null ? 'bg-(--primary)/15' : 'active:bg-card-menu'}`}
            >
              <span className={`icon-mask icon-eft-lore-traders size-5 shrink-0 ${selectedTrader === null ? 'text-(--primary)' : 'text-text-secondary'}`} />
              <span className={`flex-1 font-blender-medium text-sm uppercase tracking-widest ${selectedTrader === null ? 'text-(--primary)' : 'text-text-secondary'}`}>Все торговцы</span>
            </button>
            {traders.map((t) => {
              const active = t.normalizedName === selectedTrader;
              const lvl = clampLevel(traderLevels[t.normalizedName]);
              return (
                <button
                  key={t.normalizedName}
                  type="button"
                  onClick={() => pick(t.normalizedName)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${active ? 'bg-(--primary)/15' : 'active:bg-card-menu'}`}
                >
                  <img src={traderImg(t.normalizedName)} alt="" width={28} height={28} className="size-7 shrink-0 rounded-xs object-cover object-top" />
                  <span className={`flex-1 truncate font-blender-medium text-sm uppercase tracking-widest ${active ? 'text-(--primary)' : 'text-text-secondary'}`}>{t.name}</span>
                  <span className={`icon-mask icon-eft-profile-rep-${lvl} size-5 shrink-0 ${active ? 'text-(--primary)' : 'text-text-secondary'}`} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {pathBtn(filterLK, 'var(--color-lightkeeper)', 'icon-eft-profile-lightkeeper', 'Путь Смотрителя маяка', onLK)}
    </div>
  );
}
