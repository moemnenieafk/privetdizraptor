'use client';

// Домен «Престиж» вкладки «Трекинг» — лестница престижей 1-6 (данные: src/data/prestige.ts,
// актуализированы по зеркалу игры: престижи 1-4 = квесты «Новое начало», 5-6 запланированы).
// Текущий престиж и уровень — из телеметрии (usePlayerStore). Следующий престиж раскрыт
// чек-листом требований (авто-чек уровня), с линком на квест. Полный разбор (что
// сбрасывается/переносится) — раздел /eft/progress/prestige.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Maximize2 } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { PRESTIGE_LEVELS } from '@/data/prestige';
import { PrestigePath } from '@/components/features/prestige/PrestigePath';

// Метка-заголовок блока с линией (rule-micro-labels).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
      <span className="h-px w-6 bg-lines-hover" />
      {children}
    </h3>
  );
}

export function TrackingPrestigeDigest() {
  // mounted-гард: persist-стор только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const active = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const playerPrestige = mounted ? Number(active?.prestige ?? 0) : 0;
  const playerLevel = mounted ? Number(active?.level ?? 1) : 1;

  const nextLevel = playerPrestige + 1;

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Текущий:
          {playerPrestige > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/icons/eft/prestige/prestige-${playerPrestige}.webp`} alt="" className="h-5 w-5 object-contain" />
              <span className="text-(--primary)">Престиж {playerPrestige}</span>
            </>
          ) : (
            <span className="text-text-secondary">без престижа</span>
          )}
        </span>
        <Link
          href="/eft/progress/prestige"
          className="inline-flex h-7 items-center gap-1.5 rounded border border-lines-hover px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          Раздел «Престиж»
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mb-5">
        <PrestigePath variant="compact" />
      </div>

      <SectionLabel>Лестница престижей</SectionLabel>

      <div className="flex flex-col gap-2">
        {PRESTIGE_LEVELS.map((p) => {
          const done = playerPrestige >= p.level;
          const isNext = p.level === nextLevel && !p.planned;
          return (
            <div
              key={p.level}
              className={`rounded-lg border bg-(--color-base) ${
                done ? 'border-success/40' : isNext ? 'border-(--primary)/50' : 'border-lines-hover'
              } ${p.planned ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/icons/eft/prestige/prestige-${p.level}.webp`}
                  alt=""
                  className={`h-9 w-9 shrink-0 object-contain ${done || isNext ? '' : 'opacity-50 grayscale'}`}
                />
                <div className="min-w-0 flex-1">
                  <span className={`font-blender-medium text-type-caption uppercase tracking-widest ${done ? 'text-success' : isNext ? 'text-(--primary)' : 'text-text-secondary'}`}>
                    Престиж {p.level}
                  </span>
                  {p.minLevel != null && (
                    <span className="ml-2 text-type-micro uppercase tracking-widest text-text-muted">
                      Уровень ЧВК {p.minLevel}+
                    </span>
                  )}
                  {p.planned && (
                    <span className="ml-2 rounded-xs bg-card-menu px-1 text-type-micro uppercase tracking-widest text-text-muted">
                      скоро
                    </span>
                  )}
                </div>
                {done && <Check className="h-4 w-4 shrink-0 text-success" />}
                {isNext && p.questId && (
                  <Link
                    href={`/eft/quests/task/${p.questId}`}
                    title="Открыть квест «Новое начало»"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>

              {/* Чек-лист следующего престижа */}
              {isNext && (
                <ul className="flex flex-col gap-1.5 border-t border-lines-hover px-3 py-2.5">
                  {p.requirements.map((r, i) => {
                    const auto = r.minLevel != null;
                    const met = auto && playerLevel >= (r.minLevel ?? 0);
                    return (
                      <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                        <span
                          className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-xs border text-type-micro ${
                            met
                              ? 'border-success bg-success/15 text-success'
                              : auto
                                ? 'border-danger/50 text-danger'
                                : 'border-lines-hover text-text-muted'
                          }`}
                        >
                          {met ? '✓' : auto ? '✕' : '•'}
                        </span>
                        <span className="min-w-0 flex-1">{r.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
