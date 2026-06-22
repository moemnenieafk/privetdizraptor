'use client';

import { useEffect, useRef, useState } from 'react';
import { useGamificationStore } from '@/store/useGamificationStore';
import {
  getRankInfo,
  getNextTier,
  getTierProgress,
  getHorizon,
  getDailyGoal,
} from '@/types/gamification';
import { formatRub, formatCompactRub } from '@/lib/barter-calc';
import { useCountUp } from '@/hooks/useCountUp';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function StatsDashboard() {
  const xp = useGamificationStore((s) => s.xp);
  const sessionProfit = useGamificationStore((s) => s.sessionProfit);
  const sessionSavings = useGamificationStore((s) => s.sessionSavings);
  const badges = useGamificationStore((s) => s.badges);
  const streak = useGamificationStore((s) => s.streak);
  const bestStreak = useGamificationStore((s) => s.bestStreak);
  const dailyProfit = useGamificationStore((s) => s.dailyProfit);
  const dailyDate = useGamificationStore((s) => s.dailyDate);
  const rankUpAt = useGamificationStore((s) => s.rankUpAt);
  const hasHydrated = useGamificationStore((s) => s._hasHydrated);

  const [pulse, setPulse] = useState(false);
  const seenRankUp = useRef(rankUpAt);
  useEffect(() => {
    if (rankUpAt && rankUpAt !== seenRankUp.current) {
      seenRankUp.current = rankUpAt;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1300);
      return () => clearTimeout(t);
    }
  }, [rankUpAt]);

  const animatedXp = useCountUp(xp);

  // До регидратации persist рендерим как «нет данных» — совпадает с серверным HTML (SSR-safe).
  if (!hasHydrated) return null;
  if (xp === 0 && sessionProfit === 0) return null;

  const rank = getRankInfo(xp);
  const next = getNextTier(xp);
  const progress = getTierProgress(xp);
  const horizon = getHorizon(xp);
  const dailyGoal = getDailyGoal(xp);
  const todayProfit = dailyDate === todayKey() ? dailyProfit : 0;
  const dailyPct = Math.min(100, (todayProfit / dailyGoal) * 100);
  const unlockedBadges = badges.filter((b) => b.unlockedAt !== null);

  return (
    <div className="mt-8 overflow-hidden rounded-lg border border-lines-hover">
      <div className="border-b border-lines-hover bg-card-menu px-4 py-2">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Торговый путь
        </span>
      </div>

      <div className="space-y-4 bg-(--color-darkbase) px-4 py-4">
        {/* Rank + XP */}
        <div className="flex items-center gap-3">
          <RankEmblem level={rank.tier.level} pulse={pulse} />
          <div className="min-w-0">
            <p
              className="truncate font-blender-medium text-base uppercase tracking-widest"
              style={{ color: 'var(--primary)' }}
            >
              {rank.label}
            </p>
            <p className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
              Ранг {rank.tier.level}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-blender-medium text-sm text-text-primary">
              {formatRub(Math.round(animatedXp))}
            </p>
            {next && (
              <p className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
                из {formatCompactRub(next.xpRequired)}
              </p>
            )}
          </div>
        </div>

        <ShimmerBar pct={progress} color="var(--primary)" />
        {next && (
          <p className="-mt-2 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
            до {next.label}: {formatRub(next.xpRequired - xp)}
          </p>
        )}

        {/* Horizon — мега-веха */}
        <div className="pt-1">
          <div className="mb-1.5 flex items-center justify-between">
            <span
              className="font-blender-medium text-type-caption uppercase tracking-widest"
              style={{ color: 'var(--color-kappa)' }}
            >
              ◆ Горизонт · {horizon.label}
            </span>
            <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
              {horizon.pct.toFixed(1)}%
            </span>
          </div>
          <ShimmerBar pct={horizon.pct} color="var(--color-kappa)" />
        </div>

        {/* Session / streak / daily */}
        <div className="flex flex-wrap gap-2 pt-1">
          {sessionProfit > 0 && (
            <Chip label="Профит сессии" value={`+${formatRub(sessionProfit)}`} color="var(--color-success)" />
          )}
          {sessionSavings > 0 && (
            <Chip label="Сэкономлено" value={`+${formatRub(sessionSavings)}`} color="var(--color-success)" />
          )}
          {streak > 0 && (
            <Chip
              label={`Серия · рекорд ${bestStreak}`}
              value={`▲ ×${streak}`}
              color="var(--primary)"
            />
          )}
          <DailyChip pct={dailyPct} current={todayProfit} goal={dailyGoal} />
        </div>

        {/* Badges */}
        {unlockedBadges.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-lines-hover pt-3">
            {unlockedBadges.map((badge) => (
              <div
                key={badge.id}
                title={badge.description}
                className="rounded border px-2 py-1"
                style={{
                  borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)',
                  background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                }}
              >
                <span
                  className="font-blender-medium text-type-caption uppercase tracking-widest"
                  style={{ color: 'var(--primary)' }}
                >
                  ▲ {badge.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RankEmblem({ level, pulse }: { level: number; pulse: boolean }) {
  const color = 'var(--primary)';
  return (
    <div
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
        pulse ? 'animate-[fresh-unlock_1.3s_ease-out]' : ''
      }`}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full">
        <polygon points="24,3 42,13 42,35 24,45 6,35 6,13" fill={color} opacity="0.12" />
        <polygon points="24,3 42,13 42,35 24,45 6,35 6,13" fill="none" stroke={color} strokeWidth="2" />
      </svg>
      <span className="relative font-blender-medium text-lg leading-none" style={{ color }}>
        {level}
      </span>
    </div>
  );
}

function ShimmerBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full border border-lines-hover bg-(--color-base)">
      <div
        className="relative h-full overflow-hidden rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${Math.max(pct, 2)}%`,
          background: color,
          boxShadow: `0 0 10px color-mix(in srgb, ${color} 55%, transparent)`,
        }}
      >
        <div className="absolute inset-y-0 left-0 w-1/3 animate-shimmer bg-linear-to-r from-transparent via-white/45 to-transparent" />
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded border border-lines-hover bg-card-menu px-3 py-1.5">
      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className="font-blender-medium text-sm" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function DailyChip({ pct, current, goal }: { pct: number; current: number; goal: number }) {
  return (
    <div className="flex min-w-37.5 flex-1 flex-col gap-1 rounded border border-lines-hover bg-card-menu px-3 py-1.5">
      <div className="flex items-center justify-between">
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          Цель дня
        </span>
        <span className="font-blender-medium text-type-micro text-text-muted">
          {formatCompactRub(current)} / {formatCompactRub(goal)}
        </span>
      </div>
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-(--color-base)">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: 'var(--color-success)' }}
        />
      </div>
    </div>
  );
}
