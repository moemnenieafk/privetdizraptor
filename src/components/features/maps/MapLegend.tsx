'use client';

import { MAP_LEGEND, markerIconUrl, markerColor } from '@/data/map-marker-icons';

/**
 * Легенда карты из резолвера иконок (map-marker-icons): webp → цветной <img>,
 * svg → монохромный mask цветом типа, нет арта → цветная фигура-плейсхолдер.
 */
export function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-col gap-1.5 rounded-sm border border-lines-hover bg-(--color-base)/80 px-3 py-2.5 backdrop-blur-md">
      <div className="mb-0.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">Легенда</div>
      {MAP_LEGEND.map((e) => {
        const icon = markerIconUrl(e.sample);
        const color = markerColor(e.type);
        return (
          <div key={e.type} className="flex items-center gap-2 font-blender-book text-type-caption text-text-secondary">
            {icon?.mode === 'img' ? (
              <img src={icon.url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
            ) : icon?.mode === 'mask' ? (
              <span
                className="h-3.5 w-3.5 shrink-0"
                style={{
                  backgroundColor: color,
                  maskImage: `url(${icon.url})`,
                  WebkitMaskImage: `url(${icon.url})`,
                  maskSize: 'contain',
                  WebkitMaskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskPosition: 'center',
                }}
              />
            ) : (
              <span
                className="h-2.5 w-2.5 shrink-0"
                style={{ backgroundColor: color, borderRadius: e.type === 'container' ? '2px' : '50%' }}
              />
            )}
            {e.ru}
          </div>
        );
      })}
    </div>
  );
}
