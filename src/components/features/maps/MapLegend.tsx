'use client';

import { LEGEND_V1 } from '@/data/map-marker-icons';

/**
 * Легенда карты из единой таблицы соответствия (map-marker-icons): где есть иконка ЦТА —
 * рисуем её, где пробел (todo) — цветная фигура-плейсхолдер до отрисовки в стиле ЦТА.
 */
export function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-col gap-1.5 rounded-sm border border-lines-hover bg-(--color-base)/80 px-3 py-2.5 backdrop-blur-md">
      <div className="mb-0.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">Легенда</div>
      {LEGEND_V1.map((m) => (
        <div
          key={m.kind + (m.sub ?? '')}
          className="flex items-center gap-2 font-blender-book text-type-caption text-text-secondary"
        >
          {m.icon ? (
            <span
              className="icon-mask h-3 w-3 bg-text-secondary"
              style={{
                maskImage: `url(${m.icon})`,
                WebkitMaskImage: `url(${m.icon})`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
              }}
            />
          ) : (
            <span className={`cta-legend ${m.shape ?? ''}`} />
          )}
          {m.ru}
        </div>
      ))}
    </div>
  );
}
