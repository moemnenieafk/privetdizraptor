'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Minus, Plus, RotateCcw } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePrestigeProgressStore, prestigeObjKey } from '@/store/usePrestigeProgressStore';
import { computePrestigePath, type ObjectiveState } from '@/lib/prestige-progress';
import { PRESTIGE_OBJECTIVES, PRESTIGE_MAX_ACTIVE, PRESTIGE_SHOWCASE } from '@/data/prestige';
import { ProgressRing } from '@/components/ui/ProgressRing';

function ObjectiveRow({
  state,
  objKey,
}: {
  state: ObjectiveState;
  objKey: string;
}) {
  const incCount = usePrestigeProgressStore((s) => s.incCount);
  const decCount = usePrestigeProgressStore((s) => s.decCount);
  const toggleFlag = usePrestigeProgressStore((s) => s.toggleFlag);

  const check = (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-xs border text-type-micro ${
        state.done ? 'border-success bg-success/15 text-success' : 'border-lines-hover text-text-muted'
      }`}
    >
      {state.done ? '✓' : '•'}
    </span>
  );

  return (
    <li className="flex items-center gap-3">
      {check}
      <span className={`min-w-0 flex-1 text-sm font-blender-book ${state.done ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
        {state.label}
      </span>

      {state.kind === 'level' && (
        <span className="shrink-0 text-type-caption font-blender-medium text-text-muted">
          {state.current}/{state.target}
        </span>
      )}

      {state.kind === 'flag' && (
        <button
          type="button"
          onClick={() => toggleFlag(objKey)}
          className={`flex h-7 shrink-0 items-center gap-1 rounded border px-2 text-type-micro font-blender-medium uppercase tracking-widest transition-colors ${
            state.done
              ? 'border-success/50 text-success'
              : 'border-lines-hover text-text-secondary hover:border-(--primary) hover:text-(--primary)'
          }`}
        >
          <Check className="size-3.5" /> {state.done ? 'Готово' : 'Отметить'}
        </button>
      )}

      {state.kind === 'count' && (
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label="−1"
            onClick={() => decCount(objKey)}
            className="flex size-7 items-center justify-center rounded border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-10 text-center text-type-caption font-blender-medium tabular-nums text-text-primary">
            {state.current}/{state.target}
          </span>
          <button
            type="button"
            aria-label="+1"
            onClick={() => incCount(objKey, state.target)}
            className="flex size-7 items-center justify-center rounded border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <Plus className="size-3.5" />
          </button>
        </span>
      )}
    </li>
  );
}

export function PrestigePath({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const active = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const profileId = active?.id ?? 'default';
  const playerLevel = mounted ? Number(active?.level ?? 1) : 1;
  const playerPrestige = mounted ? Number(active?.prestige ?? 0) : 0;

  const values = usePrestigeProgressStore((s) => s.values);
  const resetLevel = usePrestigeProgressStore((s) => s.resetLevel);

  const nextPrestige = playerPrestige + 1;
  const objectives = PRESTIGE_OBJECTIVES[nextPrestige] ?? [];
  const trackable = nextPrestige <= PRESTIGE_MAX_ACTIVE && objectives.length > 0;

  const path = computePrestigePath(
    objectives,
    (objId) => values[prestigeObjKey(profileId, nextPrestige, objId)] ?? 0,
    playerLevel,
  );

  // Планируемый (5-6) или максимум активных
  if (mounted && !trackable) {
    const planned = nextPrestige <= 6;
    return (
      <section className="rounded-md border border-lines-hover bg-card-menu p-5">
        <h2 className="mb-2 text-lg font-blender-medium uppercase tracking-widest text-text-primary">Путь к Престижу</h2>
        <p className="text-sm text-text-secondary font-blender-book">
          {planned
            ? `Престиж ${nextPrestige} запланирован разработчиками — требования пока не объявлены. Держим позицию, другалёк.`
            : 'Все активные престижи взяты. Красавчик — ждём новых уровней.'}
        </p>
      </section>
    );
  }

  const ringSize = variant === 'compact' ? 80 : 104;

  return (
    <section className="rounded-md border border-(--primary)/40 bg-card-menu p-5">
      <div className="flex items-center gap-4">
        <ProgressRing percent={mounted ? path.percent : 0} size={ringSize} stroke={variant === 'compact' ? 7 : 9}>
          <span className="text-xl font-blender-medium tabular-nums text-text-primary">{mounted ? path.percent : 0}%</span>
          <span className="text-type-micro uppercase tracking-widest text-text-muted">готово</span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">
            До престижа
          </span>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/icons/eft/prestige/prestige-${nextPrestige}.webp`}
              alt=""
              className="size-8 shrink-0 object-contain opacity-70 grayscale"
            />
            <h2 className="truncate text-lg font-blender-medium uppercase tracking-widest text-text-primary">
              Престиж {nextPrestige}
            </h2>
          </div>
          <p className="mt-0.5 text-type-caption font-blender-book text-text-secondary">
            {path.doneCount}/{path.total} целей{path.remaining ? ` · осталось: ${path.remaining}` : ''}
          </p>
          <p className="mt-1 text-type-caption font-blender-book text-(--primary)">
            {path.percent >= 100 ? 'Всё готово — забирай престиж!' : `Поднажми, другалёк — награды Престижа ${nextPrestige} уже близко.`}
          </p>
        </div>
      </div>

      {/* Цели с тап-счётчиками */}
      <ul className="mt-4 flex flex-col gap-2.5 border-t border-lines-hover pt-4">
        {path.objectives.map((s) => (
          <ObjectiveRow key={s.id} state={s} objKey={prestigeObjKey(profileId, nextPrestige, s.id)} />
        ))}
      </ul>

      {/* Тизер наград (только full) */}
      {variant === 'full' && (
        <div className="mt-4 border-t border-lines-hover pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
              Что откроется
            </h3>
            <button
              type="button"
              onClick={() => resetLevel(profileId, nextPrestige)}
              className="flex items-center gap-1 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
            >
              <RotateCcw className="size-3" /> сбросить
            </button>
          </div>
          <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {PRESTIGE_SHOWCASE.slice(0, 8).map((src) => (
              <li
                key={src}
                className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-sm border border-lines-hover bg-(--color-base)"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className={`size-full object-contain transition-all ${path.percent >= 100 ? '' : 'opacity-40 grayscale'}`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {variant === 'compact' && (
        <Link
          href="/eft/progress/prestige"
          className="mt-4 flex items-center justify-center gap-1.5 rounded border border-lines-hover py-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          Открыть путь целиком <ArrowRight className="size-3.5" />
        </Link>
      )}
    </section>
  );
}
