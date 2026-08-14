'use client';

// Вкладка «Документы»: игровые ячейки-валюты с фоном редкости (getTarkovCellColor) и
// счётчиками −/+ собранного (localStorage). Фон ячейки заливается «баком» (FillMedia) по
// прогрессу собрано/нужно — как в трекере убежища. Плюс сводка гранд-тоталов, где лутать и
// дневные лимиты с ETA.
import { Minus, Plus } from 'lucide-react';
import {
  BP_DAILY_LIMITS,
  BP_DOCS,
  BP_DOC_ORDER,
  BP_SECRET_DATA_NOTE,
  type BpDocType,
} from '@/data/eft-battlepass';
import { etaDays, type TrackerSummary } from '@/lib/battlepass';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor, getTarkovCellColor } from '@/lib/tarkov-colors';
import { FillMedia } from '@/components/ui/FillMedia';

interface Props {
  summary: TrackerSummary;
  collected: Partial<Record<BpDocType, number>>;
  onInc: (type: BpDocType, delta: number) => void;
}

function TotalStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-lines-hover bg-(--color-base) px-4 py-3">
      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className={`font-blender-medium text-2xl ${tone}`}>{value}</span>
    </div>
  );
}

/** Ячейка документа: рарити-фон, иконка, счётчик −/+, заливка-бак собрано/нужно. */
function DocCell({
  type,
  collected,
  goal,
  onInc,
}: {
  type: BpDocType;
  collected: number;
  goal: number;
  onInc: (delta: number) => void;
}) {
  const doc = BP_DOCS[type];
  const done = goal > 0 && collected >= goal;
  const pct = goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : collected > 0 ? 100 : 0;

  return (
    <div
      className="flex flex-col items-center gap-2.5 rounded-sm border bg-(--color-base) p-3"
      style={{ borderColor: getTarkovBackgroundColor(doc.rarity).replace('0.3', '0.55') }}
    >
      {/* Игровая ячейка с фоном редкости + бак заливки; клик = +1 */}
      <FillMedia
        imageSrc={itemIconUrl(doc.itemId)}
        alt={doc.name}
        sizeClass="h-18 w-18"
        bgColor={getTarkovCellColor(doc.rarity)}
        pct={pct}
        done={done}
        onTap={() => onInc(1)}
        tapTitle={`${doc.name} — клик: +1`}
        imgLoading="lazy"
      />

      <span
        className="text-center font-blender-medium text-type-micro uppercase leading-tight tracking-wide text-text-secondary"
        title={doc.name}
      >
        {doc.short}
      </span>

      {/* Счётчик −/+ */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Убавить"
          onClick={() => onInc(-1)}
          disabled={collected <= 0}
          className="flex h-7 w-7 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className={`w-14 text-center font-blender-medium text-base ${done ? 'text-nvg-green' : 'text-text-primary'}`}>
          {collected}
          <span className="text-type-micro text-text-muted"> / {goal}</span>
        </span>
        <button
          type="button"
          aria-label="Прибавить"
          onClick={() => onInc(1)}
          className="flex h-7 w-7 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Где лутать */}
      <div className="flex flex-wrap justify-center gap-1">
        {doc.maps.map((m) => (
          <span
            key={m}
            className="rounded-xs border border-lines-hover bg-(--color-darkbase) px-1.5 py-px font-blender-medium text-type-micro uppercase tracking-wide text-text-muted"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BattlePassDocuments({ summary, collected, onInc }: Props) {
  const collectedTotal = BP_DOC_ORDER.reduce((n, t) => n + (collected[t] ?? 0), 0);
  const pct = summary.neededTotal > 0 ? Math.round((summary.spentTotal / summary.neededTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Гранд-тоталы ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Всего документации на весь Боевой Пропуск
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TotalStat label="Нужно всего" value={summary.neededTotal} tone="text-text-primary" />
          <TotalStat label="Собрано в руках" value={collectedTotal} tone="text-(--primary)" />
          <TotalStat label="Потрачено (получено)" value={summary.spentTotal} tone="text-nvg-green" />
          <TotalStat label="Осталось нужно" value={summary.remainingTotal} tone="text-tactical-amber" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--color-darkbase)">
            <div className="h-full rounded-full bg-(--primary) transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-blender-medium text-type-caption text-text-secondary">{pct}% получено</span>
        </div>
      </section>

      {/* ── Ячейки-документы со счётчиками ───────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Документы — валюта пропуска · отмечай собранное −/+
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
          {BP_DOC_ORDER.map((t) => (
            <DocCell
              key={t}
              type={t}
              collected={collected[t] ?? 0}
              goal={Math.max(0, summary.needed[t] - summary.spent[t])}
              onInc={(d) => onInc(t, d)}
            />
          ))}
        </div>
        <p className="font-blender-book text-type-caption leading-relaxed text-text-muted">
          «/ N» — сколько документов этого типа ещё нужно на невыбранные награды (пересчитывается, когда
          отмечаешь награду полученной). Клик по ячейке — +1.
        </p>
      </section>

      {/* ── Дневной лимит + ETA ──────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Дневной лимит добычи документов
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {BP_DAILY_LIMITS.map((lim) => {
            const days = etaDays(summary.remainingTotal, lim.limit);
            return (
              <div key={lim.mode} className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-4">
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
          рейдо-дней — по остатку ({summary.remainingTotal} док.) при полном использовании лимита.
        </p>
        <p className="font-blender-book text-type-caption leading-relaxed text-text-muted">{BP_SECRET_DATA_NOTE}</p>
      </section>
    </div>
  );
}
