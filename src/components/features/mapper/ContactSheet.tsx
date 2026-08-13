'use client';

// Контактный лист — каноны в финальном масштабе, стиль и коллизии видны только рядом (§ручной пайплайн).
// Скаффолд: статус generated/traced по стадии + скелетон-превью (≤512px эндпоинт — TODO).

import { useMapperStore } from '@/store/useMapperStore';

const BADGE: Record<string, string> = {
  clustered: 'ждёт генерации',
  generated: 'сгенерирован',
  traced: 'трассирован',
};

export function ContactSheet() {
  const objects = useMapperStore((s) => s.objects);
  const canon = objects.filter((o) => o.isClusterCanonical && !o.isClutter);
  const traced = canon.filter((o) => o.stage === 'traced').length;
  if (!canon.length) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="font-blender-medium text-[10px] uppercase tracking-widest text-neutral-500">Контактный лист</div>
        <div className="text-[10px] text-neutral-600">{traced}/{canon.length} трассировано</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {canon.map((o) => (
          <figure key={o.id} className="rounded border border-neutral-800 p-1.5">
            <div className="aspect-square animate-pulse rounded bg-neutral-800" title={o.paths.svg ?? o.paths.generated ?? o.id} />
            <figcaption className="mt-1 flex items-center justify-between text-[10px]">
              <span className="truncate text-neutral-400">{o.typeKey ?? o.id}</span>
              <span className="text-neutral-600">{BADGE[o.stage] ?? o.stage}</span>
            </figcaption>
            {o.error && <div className="truncate text-[9px] text-red-400/80" title={o.error}>{o.error}</div>}
          </figure>
        ))}
      </div>
    </section>
  );
}
