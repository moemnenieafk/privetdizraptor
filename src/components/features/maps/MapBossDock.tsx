'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MapBossStat } from './map-frame-types';

/**
 * Десктоп-док боссов — плавающий оверлей внизу-по-центру карты (GRILL-2; был низ-лево).
 * Ряд кнопок (иконка 28px + % шанса); клик → подлёт к спавнам (onBossClick → focusPoints).
 * СВОРАЧИВАЕМЫЙ шевроном внизу, по умолчанию СВЁРНУТ — инфа не критичная. Сворачивается вниз
 * (grid-rows height-анимация) и разворачивается обратно на своё место.
 * Мобилка использует свою раскладку (MapBottomBar) — сюда не идёт (hidden lg:block).
 */
export function MapBossDock({
  bosses,
  onBossClick,
}: {
  bosses: MapBossStat[];
  onBossClick?: (boss: MapBossStat) => void;
}) {
  const [open, setOpen] = useState(false); // по умолчанию свёрнут
  if (bosses.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-1/2 z-20 hidden -translate-x-1/2 lg:block">
      <div className="flex flex-col overflow-hidden rounded-t-lg border border-lines-hover bg-card-menu backdrop-blur-sm">
        {/* Ряд боссов — сворачивается вниз (анимация grid-template-rows 1fr↔0fr) */}
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="flex h-14 items-center gap-2 px-7">
              {bosses.map((b) => {
                const clickable = b.spawns.length > 0 && !!onBossClick;
                return (
                  <button
                    key={b.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && onBossClick?.(b)}
                    title={clickable ? `${b.name} — показать спавны` : b.name}
                    className={`flex h-7 items-center gap-1 rounded-xs px-0.5 font-blender-medium text-type-caption transition-colors ${
                      clickable ? 'cursor-pointer hover:text-(--primary)' : 'cursor-default opacity-50'
                    }`}
                  >
                    {b.icon && (
                      <img
                        src={b.icon}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0 rounded-xs object-contain"
                      />
                    )}
                    {b.spawnChance != null && (
                      <span className="text-(--primary)">{Math.round(b.spawnChance * 100)}%</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Шеврон-переключатель внизу: свёрнут → «Боссы ⌃», развёрнут → ⌄ */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Свернуть боссов' : 'Развернуть боссов'}
          title={open ? 'Свернуть' : `Боссы (${bosses.length})`}
          className={`flex h-6 items-center justify-center gap-1.5 text-text-muted transition-colors hover:bg-lines-hover hover:text-(--primary) ${
            open ? 'border-t border-lines-hover' : ''
          }`}
        >
          {!open && <span className="font-blender-medium text-type-micro uppercase tracking-widest">Боссы</span>}
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? '' : 'rotate-180'}`} />
        </button>
      </div>
    </div>
  );
}
