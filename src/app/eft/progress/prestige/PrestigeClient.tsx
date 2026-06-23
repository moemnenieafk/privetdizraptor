'use client';

import { useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { PRESTIGE_LEVELS, PRESTIGE_RESETS, PRESTIGE_KEEPS } from '@/data/prestige';

export function PrestigeClient() {
  const profiles = usePlayerStore((s) => s.profiles);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const active = profiles.find((p) => p.id === activeId);
  const playerLevel = Number(active?.level ?? 1);
  const playerPrestige = Number(active?.prestige ?? 0);

  const [tab, setTab] = useState(0);
  const lvl = PRESTIGE_LEVELS[tab];
  const metCount = lvl.requirements.filter((r) => r.minLevel != null && playerLevel >= r.minLevel).length;
  const autoReqs = lvl.requirements.filter((r) => r.minLevel != null).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-blender-medium uppercase tracking-widest text-text-secondary">
          Текущий: <span className="text-(--primary)">Престиж {playerPrestige}</span>
        </span>
        <div className="ml-auto flex gap-1.5">
          {PRESTIGE_LEVELS.map((p, i) => (
            <button
              key={p.level}
              type="button"
              onClick={() => setTab(i)}
              className={`h-9 rounded px-4 text-type-caption font-blender-medium uppercase tracking-widest transition-colors ${
                tab === i
                  ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)'
                  : 'border border-lines-hover bg-card-menu text-text-secondary hover:text-text-primary'
              }`}
            >
              Престиж {p.level}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Требования */}
        <section className="rounded-md border border-lines-hover bg-card-menu p-5">
          <h2 className="mb-4 text-lg font-blender-medium uppercase tracking-widest text-text-primary">
            Требования (Престиж {lvl.level})
          </h2>
          <ul className="flex flex-col gap-2.5">
            {lvl.requirements.map((req, i) => {
              const auto = req.minLevel != null;
              const met = auto && playerLevel >= (req.minLevel ?? 0);
              return (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-xs border text-type-caption ${
                      met ? 'border-success bg-success/15 text-success' : 'border-lines-hover text-text-muted'
                    }`}
                  >
                    {met ? '✓' : auto ? '✕' : '•'}
                  </span>
                  <span className="text-text-secondary font-blender-book">
                    {req.label}
                    {auto && <span className="ml-1 text-text-muted">(сейчас ур. {playerLevel})</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          {autoReqs > 0 && (
            <p className="mt-4 text-type-caption uppercase tracking-widest text-text-muted">
              Авто-проверка по уровню: {metCount}/{autoReqs}
            </p>
          )}
        </section>

        {/* Награды */}
        <section className="rounded-md border border-lines-hover bg-card-menu p-5">
          <h2 className="mb-4 text-lg font-blender-medium uppercase tracking-widest text-text-primary">Награды</h2>
          <ul className="flex flex-col gap-2.5">
            {lvl.rewards.map((rw, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-text-secondary font-blender-book">
                <span className="text-(--primary)">🏅</span> {rw}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Сбрасывается / переносится */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border-l-2 border-danger bg-card-menu p-5">
          <h3 className="mb-3 text-type-caption font-blender-medium uppercase tracking-widest text-danger">Сбрасывается</h3>
          <ul className="flex flex-col gap-1.5">
            {PRESTIGE_RESETS.map((x) => (
              <li key={x} className="text-sm text-text-secondary font-blender-book">• {x}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-md border-l-2 border-success bg-card-menu p-5">
          <h3 className="mb-3 text-type-caption font-blender-medium uppercase tracking-widest text-success">Переносится</h3>
          <ul className="flex flex-col gap-1.5">
            {PRESTIGE_KEEPS.map((x) => (
              <li key={x} className="text-sm text-text-secondary font-blender-book">• {x}</li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-type-caption text-text-muted font-blender-book">
        ⚠ Точные числовые пороги (уровни навыков/убежища, суммы) меняются между патчами — сверяйтесь с актуальной
        версией перед престижем.
      </p>
    </div>
  );
}
