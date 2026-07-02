'use client';

// Вкладка «Трекинг» Аккаунт Центра — единый хаб прогресса игрока (v1: достижения EFT).
// Первый экран — вотчлист «отслеживаю» (мои цели + SMART-чипы «как добить»), ниже —
// обзор прогресса с разбивкой по официальной редкости. Структура мультигейм-ready:
// список секций по играм (пока одна — EFT). Решение: docs/decisions/player-tracking-tab.md.
// Данные достижений/подсказок приходят с сервера (account/page.tsx), трекинг — из
// useAchievementStore (mounted-гард против hydration mismatch).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, EyeOff, ArrowRight } from 'lucide-react';
import { useAchievementStore } from '@/store/useAchievementStore';
import { rarityMeta, type AchievementView, type AchRarity } from '@/lib/achievement-visuals';
import { achievementIconUrl, ACHIEVEMENT_ICON_FALLBACK } from '@/lib/achievement-icon';
import type { AchievementHint } from '@/lib/achievement-hints';
import { AchievementTrackToggle } from '@/components/features/achievements/AchievementTrackToggle';
import { MiniChip } from '@/components/features/achievements/HintChips';

// Реестр игр вкладки (мультигейм: новые игры добавляются записью сюда).
const TRACKING_GAMES = [
  { id: 'eft', logo: '/images/games/eft-logo.webp', title: 'Escape From Tarkov' },
] as const;

const MAX_CHIPS = 4;

function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src.endsWith(ACHIEVEMENT_ICON_FALLBACK)) return;
  img.src = ACHIEVEMENT_ICON_FALLBACK;
}

// Метка-заголовок блока с линией (rule-micro-labels: text-type-micro).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
      <span className="h-px w-6 bg-lines-hover" />
      {children}
    </h3>
  );
}

// ─── Карточка вотчлиста ────────────────────────────────────────────────────────
function WatchCard({ a, hint }: { a: AchievementView; hint?: AchievementHint }) {
  const r = rarityMeta(a.normalizedRarity);
  const toggleTracked = useAchievementStore((s) => s.toggleTracked);
  const chips = hint?.links.slice(0, MAX_CHIPS) ?? [];

  return (
    <div className={`relative overflow-hidden rounded-lg border bg-card-menu p-4 ${r.borderClass}`}>
      {r.tintClass && <div className={`pointer-events-none absolute inset-0 ${r.tintClass}`} />}

      <div className="relative z-10 flex gap-4">
        <Link href={`/eft/progress/achievements/${a.id}`} className="h-16 w-16 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={achievementIconUrl(a.id)}
            alt={a.name}
            loading="lazy"
            onError={onImgError}
            className="h-full w-full object-contain transition-transform duration-300 hover:scale-110"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/eft/progress/achievements/${a.id}`}
              className="flex min-w-0 items-center gap-2 font-blender-medium text-base uppercase leading-tight text-text-primary transition-colors hover:text-(--primary)"
            >
              <span className="truncate">{a.name}</span>
              {a.hidden && <EyeOff className="h-4 w-4 shrink-0 text-text-primary/50" />}
            </Link>

            <div className="flex shrink-0 items-center gap-1">
              <AchievementTrackToggle id={a.id} variant="compact" />
              <span
                role="button"
                tabIndex={0}
                aria-label="Не отслеживать"
                title="Не отслеживать"
                onClick={() => toggleTracked(a.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTracked(a.id);
                  }
                }}
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded border border-(--primary)/60 bg-primary/15 text-(--primary) transition-colors hover:border-text-primary/50 hover:bg-transparent hover:text-text-primary/50"
              >
                <Star className="h-3.5 w-3.5 fill-current" />
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-xs px-1.5 py-0.5 text-type-micro uppercase tracking-widest ${r.badgeClass}`}>
              {r.label}
            </span>
            <span className="font-blender-medium text-type-micro text-text-primary/70">
              {a.playersCompletedPercent.toFixed(1)}% игроков
            </span>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((l) => (
                <MiniChip key={`${l.kind}:${l.href}`} link={l} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Панель ────────────────────────────────────────────────────────────────────
export function TrackingPanel({
  achievements,
  hints,
}: {
  achievements: AchievementView[];
  hints: Record<string, AchievementHint>;
}) {
  // mounted-гард: persist-стор читаем только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const trackedIds = useAchievementStore((s) => s.trackedIds);
  const completedIds = useAchievementStore((s) => s.completedIds);

  const byId = useMemo(() => new Map(achievements.map((a) => [a.id, a])), [achievements]);
  const watch = useMemo(
    () =>
      mounted
        ? trackedIds.map((id) => byId.get(id)).filter((x): x is AchievementView => Boolean(x))
        : [],
    [mounted, trackedIds, byId],
  );
  const completedSet = useMemo(
    () => new Set(mounted ? completedIds : []),
    [mounted, completedIds],
  );

  const total = achievements.length;
  const doneTotal = useMemo(
    () => achievements.reduce((n, a) => n + (completedSet.has(a.id) ? 1 : 0), 0),
    [achievements, completedSet],
  );
  const donePct = total > 0 ? Math.round((doneTotal / total) * 100) : 0;

  const tiers = useMemo(
    () =>
      (['legendary', 'rare', 'common'] as AchRarity[]).map((key) => {
        const list = achievements.filter((a) => a.normalizedRarity === key);
        return {
          meta: rarityMeta(key),
          total: list.length,
          done: list.reduce((n, a) => n + (completedSet.has(a.id) ? 1 : 0), 0),
        };
      }),
    [achievements, completedSet],
  );

  const game = TRACKING_GAMES[0];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Секция игры (мультигейм-ready: одна секция на игру) ── */}
      <div className="rounded border border-lines-hover bg-card-menu p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-lines-hover pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={game.logo}
            alt={game.title}
            className="h-8 w-auto object-contain opacity-70"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const next = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (next) next.style.removeProperty('display');
            }}
          />
          <span className="hidden font-blender-medium text-xs uppercase tracking-widest text-text-muted">
            {game.title}
          </span>
          <span className="ml-auto font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
            Достижения:{' '}
            <span className="text-success">{mounted ? doneTotal : 0}</span>
            <span className="text-text-muted"> / {total}</span>
          </span>
        </div>

        {/* ── Вотчлист «отслеживаю» ── */}
        <SectionLabel>Отслеживаю · {watch.length}</SectionLabel>

        {watch.length > 0 ? (
          <div className="flex flex-col gap-3">
            {watch.map((a) => (
              <WatchCard key={a.id} a={a} hint={hints[a.id]} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-8 text-center">
            <Star className="h-6 w-6 text-text-muted" />
            <p className="max-w-90 text-sm text-text-secondary">
              Вотчлист пуст. Отмечайте достижения кнопкой «Отслеживать» — цели и подсказки, как их
              добить, соберутся здесь.
            </p>
            <Link
              href="/eft/progress/achievements"
              className="inline-flex items-center gap-2 rounded border border-lines-hover px-4 py-2 font-blender-medium text-type-label uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              К достижениям
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── Обзор прогресса по редкости ── */}
        <div className="mt-8">
          <SectionLabel>Прогресс</SectionLabel>

          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-primary/50">
              Выполнено всего
            </span>
            <span className="font-blender-medium text-xs text-text-primary">
              {mounted ? doneTotal : 0} / {total}
              <span className="ml-2 text-text-primary/50">{mounted ? donePct : 0}%</span>
            </span>
          </div>
          <div className="mb-6 h-2 overflow-hidden rounded-xs bg-(--color-base)">
            <div
              className="h-full rounded-xs bg-success transition-[width] duration-500"
              style={{ width: `${mounted ? donePct : 0}%` }}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tiers.map((t) => {
              const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
              return (
                <div key={t.meta.key} className="rounded-lg border border-lines-hover bg-(--color-base) p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-xs px-1.5 py-0.5 text-type-micro uppercase tracking-widest ${t.meta.badgeClass}`}>
                      {t.meta.label}
                    </span>
                    <span className="font-blender-medium text-type-micro text-text-primary/70">
                      {mounted ? t.done : 0} / {t.total}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-xs bg-card-menu">
                    <div
                      className={`h-full rounded-xs transition-[width] duration-500 ${t.meta.barClass}`}
                      style={{ width: `${mounted ? pct : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
