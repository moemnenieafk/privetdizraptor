'use client';

// S5 — гейт описаний (скаффолд). Таблица КАНОНОВ кластеров: превью | тип | материал | subject | matte.
// subject правится inline (решение 3: неверное имя = неверный силуэт, ловится только глазами).
// Материал — из реестра палитры. Персист правок в манифест — PATCH-эндпоинт (TODO).

import { useMapperStore } from '@/store/useMapperStore';
import { FACTORY_PALETTE } from '@/lib/mapper/palette';

export function SubjectReview() {
  const objects = useMapperStore((s) => s.objects);
  const setSubject = useMapperStore((s) => s.setSubject);
  const canon = objects.filter((o) => o.isClusterCanonical && !o.isClutter);
  if (!canon.length) return null;

  return (
    <section className="space-y-2">
      <div className="font-blender-medium text-[10px] uppercase tracking-widest text-neutral-500">S5 · Ревью описаний · {canon.length} канонов</div>
      <div className="overflow-x-auto rounded border border-neutral-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-900/60 text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="p-2">Тип</th>
              <th className="p-2">Материал</th>
              <th className="p-2 w-1/2">Subject (правь inline)</th>
              <th className="p-2">Matte</th>
            </tr>
          </thead>
          <tbody>
            {canon.map((o) => (
              <tr key={o.id} className="border-t border-neutral-800/70">
                <td className="p-2 text-neutral-300">{o.typeKey ?? o.id}</td>
                <td className="p-2 text-neutral-500">
                  <select defaultValue={o.material ?? ''} className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-[11px]">
                    <option value="">—</option>
                    {FACTORY_PALETTE.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.id}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    defaultValue={o.subject ?? o.subjectSeed ?? ''}
                    onBlur={(e) => setSubject(o.id, e.target.value)}
                    placeholder="гипер-конкретно: форма + материал + счёт частей"
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px]"
                  />
                </td>
                <td className="p-2 text-neutral-500">{o.matte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
