'use client';

import { useGamificationStore } from '@/store/useGamificationStore';
import { TRADER_TIERS } from '@/types/gamification';
import { formatRub } from '@/lib/barter-calc';

function getTier(xp: number) {
  let current = TRADER_TIERS[0];
  for (const tier of TRADER_TIERS) {
    if (xp >= tier.xpRequired) current = tier;
  }
  return current;
}

function getNextTier(xp: number) {
  return TRADER_TIERS.find((t) => t.xpRequired > xp) ?? null;
}

function getProgress(xp: number): number {
  const current = getTier(xp);
  const next = getNextTier(xp);
  if (!next) return 100;
  return Math.min(
    100,
    ((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100,
  );
}

export function StatsDashboard() {
  const xp = useGamificationStore((s) => s.xp);
  const sessionProfit = useGamificationStore((s) => s.sessionProfit);
  const sessionSavings = useGamificationStore((s) => s.sessionSavings);
  const badges = useGamificationStore((s) => s.badges);

  const unlockedBadges = badges.filter((b) => b.unlockedAt !== null);

  if (xp === 0 && sessionProfit === 0) return null;

  const tier = getTier(xp);
  const nextTier = getNextTier(xp);
  const progress = getProgress(xp);
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.floor(n));

  return (
    <div className="mt-8 border border-lines-hover">
      <div className="px-4 py-2 border-b border-lines-hover bg-card-menu">
        <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
          Торговый путь
        </span>
      </div>

      <div className="px-4 py-3 bg-(--color-darkbase) space-y-3">
        {/* XP + Tier */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="font-blender-medium text-xs uppercase tracking-widest"
                style={{ color: 'var(--primary)' }}
              >
                {tier.label}
              </span>
              <span className="font-blender-medium text-[10px] uppercase text-text-muted">
                ур.{tier.level}
              </span>
            </div>
            <span className="font-blender-medium text-[10px] text-text-muted">
              {fmt(xp)} XP{nextTier && ` / ${fmt(nextTier.xpRequired)}`}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-0.5 bg-lines-hover overflow-hidden">
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${progress}%`, background: 'var(--primary)' }}
            />
          </div>
          {nextTier && (
            <p className="mt-1 font-blender-medium text-[9px] uppercase text-text-muted">
              до {nextTier.label}: {fmt(nextTier.xpRequired - xp)} XP
            </p>
          )}
        </div>

        {/* Session stats + Badges */}
        {(sessionProfit > 0 || sessionSavings > 0 || unlockedBadges.length > 0) && (
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2 pt-2.5 border-t border-lines-hover">
            {sessionProfit > 0 && (
              <div>
                <p className="font-blender-medium text-[9px] uppercase tracking-widest text-text-muted">
                  Профит сессии
                </p>
                <p
                  className="font-blender-medium text-sm"
                  style={{ color: 'var(--color-success)' }}
                >
                  +{formatRub(sessionProfit)}
                </p>
              </div>
            )}
            {sessionSavings > 0 && (
              <div>
                <p className="font-blender-medium text-[9px] uppercase tracking-widest text-text-muted">
                  Сэкономлено
                </p>
                <p
                  className="font-blender-medium text-sm"
                  style={{ color: 'var(--color-success)' }}
                >
                  +{formatRub(sessionSavings)}
                </p>
              </div>
            )}

            {unlockedBadges.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                {unlockedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    title={badge.description}
                    className="px-2 py-1 border border-lines-hover"
                  >
                    <span
                      className="font-blender-medium text-[9px] uppercase tracking-widest"
                      style={{ color: 'var(--primary)' }}
                    >
                      ▲ {badge.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
