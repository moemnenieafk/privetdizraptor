'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X, Ban } from 'lucide-react';
import type { AnomalyRow } from '@/db/companion-anomalies';

type Action = 'approve' | 'reject' | 'ban';

export function AnomalyQueueClient({ initial }: { initial: AnomalyRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(inGameId: string, action: Action) {
    if (action === 'ban' && !window.confirm('Забанить авторов и вычистить их вклад? Отмены нет.')) return;
    setBusy(inGameId);
    try {
      const res = await fetch('/api/admin/anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inGameId, action }),
      });
      if (res.ok) setRows((r) => r.filter((x) => x.inGameId !== inGameId));
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p className="mt-10 text-center font-blender-book text-sm text-text-secondary">Аномалий на ревью нет.</p>;
  }

  return (
    <ul className="mt-6 flex flex-col gap-3">
      {rows.map((a) => {
        const cheaper = a.companionPrice < a.refPrice;
        return (
          <li
            key={a.inGameId}
            className="flex flex-col gap-3 rounded-sm border border-lines bg-(--color-base)/40 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex flex-col gap-1">
              <Link
                href={`/eft/items/item/${a.slug ?? ''}`}
                className="font-blender-medium text-sm text-text-primary hover:text-(--primary)"
              >
                {a.name ?? a.inGameId}
              </Link>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-blender-book text-type-caption text-text-secondary">
                <span>
                  сообщество <span className={cheaper ? 'text-(--color-danger)' : 'text-(--color-success)'}>
                    {a.companionPrice.toLocaleString('ru-RU')} ₽
                  </span>
                </span>
                <span className="text-text-muted">vs tarkov.dev {a.refPrice.toLocaleString('ru-RU')} ₽</span>
                <span className="font-blender-medium text-(--primary)">
                  {cheaper ? '−' : '+'}
                  {Math.round(a.deviationPct * 100)}% · {a.deviationAbs.toLocaleString('ru-RU')} ₽
                </span>
                <span className="text-text-muted">{a.offers} предл. · {a.submitters} авт.</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={busy === a.inGameId}
                onClick={() => act(a.inGameId, 'approve')}
                title="Подтвердить как источник правды"
                className="flex items-center gap-1 rounded-xs border border-(--color-success)/50 px-2.5 py-1.5 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-success) transition-colors hover:bg-(--color-success)/10 disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" /> Принять
              </button>
              <button
                type="button"
                disabled={busy === a.inGameId}
                onClick={() => act(a.inGameId, 'reject')}
                title="Отклонить цену"
                className="flex items-center gap-1 rounded-xs border border-lines-hover px-2.5 py-1.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" /> Отклонить
              </button>
              <button
                type="button"
                disabled={busy === a.inGameId}
                onClick={() => act(a.inGameId, 'ban')}
                title="Бан авторов (zero-tolerance) + вычистить вклад"
                className="flex items-center gap-1 rounded-xs border border-(--color-danger)/50 px-2.5 py-1.5 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-danger) transition-colors hover:bg-(--color-danger)/10 disabled:opacity-40"
              >
                <Ban className="h-3.5 w-3.5" /> Бан
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
