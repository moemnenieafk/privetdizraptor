'use client';

// Панель статов сборки. Главное — не абсолютные числа, а ДЕЛЬТА «сток → собранное»:
// человек хочет видеть, что дал обвес, а не сравнивать две цифры в уме.
//
// Знак ≠ цвет: у эргономики хорошо больше, у отдачи и веса — меньше. Раскраска идёт
// по СМЫСЛУ (good/bad), а не по знаку числа.
//
// Ниже — проблемы сборки из движка: пустой обязательный слот, конфликт модулей.
// Пустой обязательный слот блокирует сохранение (см. WeaponBuilder.handleSave);
// конфликты и прочее не блокируют, но видны сразу.
import { AlertTriangle } from 'lucide-react';
import type { BuildIssue, BuildStatsDelta } from '@/lib/weapon-build';

interface BuildStatsPanelProps {
  delta: BuildStatsDelta;
  issues: BuildIssue[];
}

export function BuildStatsPanel({ delta, issues }: BuildStatsPanelProps) {
  const { stock, current } = delta;

  return (
    <aside className="flex w-full flex-col gap-4 rounded-sm border border-lines-hover bg-(--color-base) p-4">
      <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
        Характеристики
      </h2>

      <div className="flex flex-col gap-2">
        <StatRow
          label="Эргономика"
          value={current.ergonomics}
          delta={delta.ergonomics}
          higherIsBetter
        />
        <StatRow
          label="Отдача, сумма"
          value={current.recoilSum}
          delta={delta.recoilSum}
          higherIsBetter={false}
          hint={`верт. ${current.recoilVertical} · гор. ${current.recoilHorizontal}`}
        />
        <StatRow
          label="Вес"
          value={current.weight}
          delta={delta.weight}
          higherIsBetter={false}
          unit=" кг"
        />

        {current.moa != null && (
          <StatRow
            label="Точность"
            value={current.moa}
            delta={stock.moa != null ? round(current.moa - stock.moa) : 0}
            higherIsBetter={false}
            unit=" MOA"
          />
        )}

        {current.capacity != null && (
          <PlainRow label="Ёмкость" value={`${current.capacity} патр.`} />
        )}
        {current.velocity != null && (
          <PlainRow label="Скорость пули" value={`${current.velocity} м/с`} />
        )}
        <PlainRow label="Модулей" value={String(current.modCount)} />
      </div>

      {issues.length > 0 && <IssueList issues={issues} />}
    </aside>
  );
}

/* ───────────────── строки ───────────────── */

interface StatRowProps {
  label: string;
  value: number;
  delta: number;
  /** Для эргономики true, для отдачи/веса/MOA false. */
  higherIsBetter: boolean;
  unit?: string;
  hint?: string;
}

function StatRow({ label, value, delta, higherIsBetter, unit = '', hint }: StatRowProps) {
  const good = higherIsBetter ? delta > 0 : delta < 0;
  const neutral = delta === 0;

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-lines-hover pb-2 last:border-0">
      <span className="flex flex-col">
        <span className="font-blender-book text-sm text-text-secondary">{label}</span>
        {hint && (
          <span className="font-blender-medium text-xs text-text-secondary/70">{hint}</span>
        )}
      </span>

      <span className="flex shrink-0 items-baseline gap-2">
        <span className="font-blender-medium text-base text-text-primary">
          {value}
          {unit}
        </span>
        {!neutral && (
          <span
            className={`font-blender-medium text-xs ${good ? 'text-success' : 'text-danger'}`}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </span>
    </div>
  );
}

function PlainRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-lines-hover pb-2 last:border-0">
      <span className="font-blender-book text-sm text-text-secondary">{label}</span>
      <span className="font-blender-medium text-base text-text-primary">{value}</span>
    </div>
  );
}

/* ───────────────── проблемы сборки ───────────────── */

function IssueList({ issues }: { issues: BuildIssue[] }) {
  // Конфликт приходит парой (А↔Б) — схлопываем в одну строку.
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const i of issues) {
    switch (i.type) {
      case 'missing_required': {
        const key = `req|${i.slotNameId}`;
        if (seen.has(key)) break;
        seen.add(key);
        lines.push(`Пустой обязательный слот: ${i.slotName}`);
        break;
      }
      case 'conflict': {
        const key = `cft|${[i.itemId, i.conflictsWithId].sort().join('|')}`;
        if (seen.has(key)) break;
        seen.add(key);
        lines.push('Конфликт модулей — вместе не встанут');
        break;
      }
      case 'not_allowed': {
        lines.push(`Модуль не подходит слоту ${i.slotNameId}`);
        break;
      }
      case 'unknown_item': {
        lines.push('Модуль из сборки больше не существует в игре');
        break;
      }
    }
  }

  if (lines.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xs border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] p-3">
      <span className="flex items-center gap-2 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Замечания
      </span>
      <ul className="flex flex-col gap-1">
        {lines.map((l, i) => (
          <li key={i} className="font-blender-book text-xs text-text-secondary">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

const round = (v: number): number => Math.round(v * 100) / 100;