'use client';

// S2 — гейт сегментации (скаффолд). Грид всех объектов: превью (скелетон, ≤512px эндпоинт TODO),
// тип, флаг хлама. Действия merge/reject/toggle-type — структура есть, персист-эндпоинт TODO.

import { useMapperStore } from '@/store/useMapperStore';

export function SegmentReview() {
  const objects = useMapperStore((s) => s.objects);
  if (!objects.length) return null;
  const shown = objects.filter((o) => o.stage !== 'rejected');
  const clutter = shown.filter((o) => o.isClutter).length;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="font-blender-medium text-[10px] uppercase tracking-widest text-neutral-500">S2 · Ревью сегментации</div>
        <div className="text-[10px] text-neutral-600">{shown.length} объектов · {clutter} помечены хламом</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((o) => (
          <div key={o.id} className="rounded border border-neutral-800 p-1.5 text-[10px]">
            <div className="mb-1 aspect-square animate-pulse rounded bg-neutral-800" title={o.paths.crop ?? o.id} />
            <div className="truncate text-neutral-300">{o.typeKey ?? o.id}</div>
            <div className="flex items-center justify-between text-neutral-600">
              <span>{o.material ?? '—'}</span>
              {o.isClutter && <span className="text-amber-500/80">хлам</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
