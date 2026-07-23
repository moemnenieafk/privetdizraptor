'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCompanionStore } from '@/store/useCompanionStore';
import type { WorklistItem } from '@/db/companion-prices';

/** «Цены, которые стоит обновить» — реактивный: после выгрузки предмет исчезает из списка. */
export function CompanionWorklist({ initial }: { initial: WorklistItem[] }) {
  const [rows, setRows] = useState(initial);
  const submitSeq = useCompanionStore((s) => s.submitSeq);
  const lastSubmittedIds = useCompanionStore((s) => s.lastSubmittedIds);

  // На каждую выгрузку (тик submitSeq) убираем только что обновлённые предметы.
  useEffect(() => {
    if (lastSubmittedIds.length === 0) return;
    setRows((r) => r.filter((x) => !lastSubmittedIds.includes(x.inGameId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- реагируем на тик выгрузки, не на массив
  }, [submitSeq]);

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          Цены, которые стоит обновить
        </span>
        <span className="h-px flex-1 bg-lines" />
      </div>
      <ul className="flex flex-col divide-y divide-lines overflow-hidden rounded-sm border border-lines">
        {rows.map((w) => (
          <li key={w.inGameId}>
            <Link
              href={`/eft/items/item/${w.slug}`}
              className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-(--color-base)/60"
            >
              <span className="truncate font-blender-book text-type-caption text-text-secondary">{w.name}</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                  {w.status === 'no-data' ? 'нет данных' : 'устарело'}
                </span>
                <span className="font-blender-medium text-xs text-text-secondary">
                  ~{w.value.toLocaleString('ru-RU')} ₽
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
