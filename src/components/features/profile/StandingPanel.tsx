'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { PlayerStanding } from '@/lib/player-standing';
import { nextStandingRank } from '@/lib/player-standing';
import { RollUpCounter } from './RollUpCounter';

// Панель Standing/Репутация: итоговый ранг + разбивка вкладов строками data-readout (§3.1 п.3).
// Пустое состояние (total=0) = call-to-action «с чего начать», а НЕ голый «0» (§4.5).
// Число ранга — roll-up счётчик (tabular-nums). Доменная логика ранга — в player-standing.ts.

interface StandingPanelProps {
  standing: PlayerStanding;
  className?: string;
}

export function StandingPanel({ standing, className = '' }: StandingPanelProps) {
  const isEmpty = standing.total <= 0;
  const next = nextStandingRank(standing.total);
  const remaining = next ? next.min - standing.total : 0;

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Шапка: ранг + сумма */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Боевая эффективность
          </span>
          <span className="text-lg font-blender-medium uppercase tracking-widest text-(--primary)">
            {standing.tierLabel}
          </span>
        </div>
        <RollUpCounter value={standing.total} className="text-2xl text-text-primary" />
      </div>

      {isEmpty ? (
        // Call-to-action вместо нулей: каждое пустое поле = следующий шаг.
        <div className="flex flex-col gap-2 rounded-xs border border-lines-hover bg-(--color-base) p-4">
          <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-primary">
            Собери эффективность
          </span>
          <p className="text-type-caption font-blender-book leading-4 text-text-secondary">
            Пройди «Путь Новобранца», добавь ЧВК-профиль и лови рекорды в аркаде — из этих
            сигналов сложится твой ранг оперативника.
          </p>
          <Link
            href="/eft/progress/rookie/path"
            className="mt-1 inline-flex w-fit items-center gap-1.5 text-type-caption font-blender-medium uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80"
          >
            Начать <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {/* Разбивка вкладов */}
          <ul className="flex flex-col gap-1.5 border-t border-lines-hover pt-3">
            {standing.contributions.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-type-caption font-blender-book text-text-secondary">
                  {c.label}
                </span>
                <span
                  className={`shrink-0 text-type-caption font-blender-medium tabular-nums tracking-wider ${
                    c.value > 0 ? 'text-text-primary' : 'text-text-muted'
                  }`}
                >
                  {c.value > 0 ? `+${c.value.toLocaleString('ru-RU')}` : '—'}
                </span>
              </li>
            ))}
          </ul>
          {next && (
            <p className="text-type-micro font-blender-book text-text-secondary">
              До ранга «{next.label}»:{' '}
              <span className="tabular-nums text-(--primary)">{remaining.toLocaleString('ru-RU')}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
