'use client';

// Очередь жалоб для модераторов (ты, Дима, добровольцы). Открывается только при
// role=admin|moderator — решает сервер.
//
// Подтверждённая жалоба = −25 кармы нарушителю (идемпотентно). Сокрытие поста —
// отдельное действие в самой теме: жалоба может быть справедливой, а пост при этом
// достаточно поправить словами.
import { useCallback, useEffect, useState } from 'react';
import { Check, Flag, Loader2, X } from 'lucide-react';
import type { ReportQueueItem } from '@/db/comlink-forum';

const REF_LABELS: Record<string, string> = {
  profile: 'Анкета',
  review: 'Отзыв',
  topic: 'Тема',
  post: 'Сообщение',
};

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function ReportsQueueClient() {
  const [reports, setReports] = useState<ReportQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/comlink/reports');
    if (res.ok) {
      const data = (await res.json()) as { reports: ReportQueueItem[] };
      setReports(data.reports);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (reportId: string, status: 'upheld' | 'rejected') => {
    setBusyId(reportId);
    await fetch('/api/comlink/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, status }),
    });
    setBusyId(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 w-full animate-pulse rounded-sm bg-card-menu" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-sm border border-lines-hover bg-(--color-base) px-6 py-14 text-center">
        <Check className="h-8 w-8 text-success" aria-hidden="true" />
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Очередь пуста
        </h2>
        <p className="font-blender-book text-sm text-text-secondary">
          Открытых жалоб нет. Тишина в эфире.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {reports.map((r) => (
        <article key={r.id} className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-xs border border-danger/40 px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-danger">
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              {REF_LABELS[r.refType] ?? r.refType}
            </span>
            <span className="font-blender-book text-xs text-text-secondary">
              {r.reporterName} → на {r.targetName} · {fmtDate(r.createdAt)}
            </span>
          </div>

          <p className="whitespace-pre-wrap font-blender-book text-sm text-text-primary">{r.reason}</p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => void resolve(r.id, 'upheld')}
              className="flex h-11 items-center gap-2 rounded-xs border border-danger px-4 font-blender-medium text-xs uppercase tracking-widest text-danger disabled:opacity-40"
            >
              {busyId === r.id ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              Подтвердить (−25 карма)
            </button>

            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => void resolve(r.id, 'rejected')}
              className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary hover:border-(--primary) hover:text-(--primary) disabled:opacity-40"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Отклонить
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
