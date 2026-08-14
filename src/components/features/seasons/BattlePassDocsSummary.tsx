'use client';

// Вкладка «Документы»: сводка сколько документации нужно / получено / осталось по типам,
// где какой документ лутается, и оценка рейдо-дней по дневным лимитам режимов.
import {
  BP_DAILY_LIMITS,
  BP_SECRET_DATA_NOTE,
} from '@/data/eft-battlepass';
import { docRows, etaDays, type TrackerSummary } from '@/lib/battlepass';
import { DocIcon } from './battlepassVisual';

/** Крупная плашка гранд-тотала. */
function TotalStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'muted' | 'primary' | 'green';
}) {
  const toneCls =
    tone === 'primary' ? 'text-(--primary)' : tone === 'green' ? 'text-nvg-green' : 'text-text-primary';
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-lines-hover bg-(--color-base) px-4 py-3">
      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className={`font-blender-medium text-2xl ${toneCls}`}>{value}</span>
    </div>
  );
}

/** Мини-стата внутри строки документа. */
function MiniStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className={`font-blender-medium text-base ${tone ?? 'text-text-primary'}`}>{value}</span>
    </span>
  );
}

export function BattlePassDocsSummary({ summary }: { summary: TrackerSummary }) {
  const rows = docRows(summary);
  const pct = summary.neededTotal > 0 ? Math.round((summary.spentTotal / summary.neededTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Гранд-тоталы документов ─────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Всего документации на весь Боевой Пропуск
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <TotalStat label="Нужно всего" value={summary.neededTotal} tone="muted" />
          <TotalStat label="Получено" value={summary.spentTotal} tone="green" />
          <TotalStat label="Осталось" value={summary.remainingTotal} tone="primary" />
        </div>
        {/* Полоска прогресса по документам */}
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--color-darkbase)">
            <div
              className="h-full rounded-full bg-(--primary) transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-blender-medium text-type-caption text-text-secondary">{pct}%</span>
        </div>
      </section>

      {/* ── Сводка по типам документов ──────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Сколько какой документации собрать и где её найти
        </h2>

        <div className="flex flex-col gap-2">
          {rows.map(({ doc, needed, spent, remaining }) => (
            <div
              key={doc.type}
              className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-3 sm:flex-row sm:items-center sm:gap-4"
            >
              {/* Документ */}
              <div className="flex items-center gap-2.5 sm:w-60 sm:shrink-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xs border border-lines-hover bg-(--color-darkbase) p-1">
                  <DocIcon doc={doc} className="h-full w-full" />
                </span>
                <span className="font-blender-medium text-sm leading-tight text-text-primary">
                  {doc.name}
                </span>
              </div>

              {/* Цифры */}
              <div className="flex items-center gap-5 sm:gap-6">
                <MiniStat label="Нужно" value={needed} />
                <MiniStat label="Получено" value={spent} tone="text-nvg-green" />
                <MiniStat
                  label="Осталось"
                  value={remaining}
                  tone={remaining > 0 ? 'text-(--primary)' : 'text-nvg-green'}
                />
              </div>

              {/* Где найти */}
              <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto sm:justify-end">
                <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                  Где найти:
                </span>
                {doc.maps.map((m) => (
                  <span
                    key={m}
                    className="rounded-xs border border-lines-hover bg-(--color-darkbase) px-2 py-0.5 font-blender-medium text-type-micro uppercase tracking-wide text-text-secondary"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Дневной лимит добычи + оценка рейдо-дней ────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Дневной лимит добычи документов
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {BP_DAILY_LIMITS.map((lim) => {
            const days = etaDays(summary.remainingTotal, lim.limit);
            return (
              <div
                key={lim.mode}
                className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-4"
              >
                <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                  {lim.mode}
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="font-blender-medium text-3xl text-text-primary">{lim.limit}</span>
                  <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                    док. / день
                  </span>
                </span>
                <span className="font-blender-medium text-type-caption uppercase tracking-widest text-(--primary)">
                  {days > 0 ? `≈ ${days} дн. до финала` : 'всё собрано'}
                </span>
              </div>
            );
          })}
        </div>
        <p className="font-blender-book text-type-caption leading-relaxed text-text-muted">
          Лимит-сутки у каждого режима свой и стартуют с первого поднятого в рейде документа. Оценка
          рейдо-дней считает по остатку ({summary.remainingTotal} док.) при полном использовании лимита.
        </p>
        <p className="font-blender-book text-type-caption leading-relaxed text-text-muted">
          {BP_SECRET_DATA_NOTE}
        </p>
      </section>
    </div>
  );
}
