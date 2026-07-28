'use client';

import type { MapBossStat } from './map-frame-types';

/**
 * Десктоп-док боссов — плавающий оверлей внизу-по-центру карты (GRILL-2; был низ-лево).
 * Ряд кнопок (иконка 28px + % шанса); клик → подлёт к спавнам (onBossClick → focusPoints).
 * Мобилка использует свою раскладку (MapBottomBar) — сюда не идёт (hidden lg:block).
 *
 * NB: точность координат спавнов — вопрос калибровки проекции карты (config.transform),
 * отдельный от этого дока; wiring клика тут не меняем.
 */
export function MapBossDock({
  bosses,
  onBossClick,
}: {
  bosses: MapBossStat[];
  onBossClick?: (boss: MapBossStat) => void;
}) {
  if (bosses.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 lg:block">
      <div className="flex items-center gap-1 rounded-sm border border-lines-hover bg-[color-mix(in_srgb,var(--color-base)_88%,transparent)] p-1.5 backdrop-blur-sm">
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
  );
}
