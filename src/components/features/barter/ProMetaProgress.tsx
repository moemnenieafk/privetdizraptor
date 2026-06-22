'use client';

import { Check, Lock } from 'lucide-react';
import { useGamificationStore } from '@/store/useGamificationStore';
import { computeProStatus, formatRemainingChallenges, PRO_UNLOCK_AT } from '@/types/gamification';

export function ProMetaProgress() {
  const xp = useGamificationStore((s) => s.xp);
  const confirmedBarterIds = useGamificationStore((s) => s.confirmedBarterIds);
  const badges = useGamificationStore((s) => s.badges);
  const hasHydrated = useGamificationStore((s) => s._hasHydrated);

  // До регидратации persist — скелетон (совпадает с серверным HTML, без flash 0/4 и mismatch).
  if (!hasHydrated) {
    return (
      <div className="mt-6 overflow-hidden rounded-lg border border-lines-hover">
        <div className="border-b border-lines-hover bg-card-menu px-4 py-2">
          <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
            Мета-прогресс · PRO-доступ
          </span>
        </div>
        <div className="space-y-3 bg-(--color-darkbase) px-4 py-4">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 animate-pulse rounded border border-lines-hover bg-card-menu" />
            ))}
          </div>
          <div className="h-2 animate-pulse rounded-full bg-card-menu" />
        </div>
      </div>
    );
  }

  const { challenges, completedCount, isUnlocked } = computeProStatus(xp, confirmedBarterIds, badges);
  const progressPct = Math.min(100, (completedCount / PRO_UNLOCK_AT) * 100);
  const remaining = PRO_UNLOCK_AT - completedCount;

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-lines-hover">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-lines-hover bg-card-menu px-4 py-2">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Мета-прогресс · PRO-доступ
        </span>
        {isUnlocked ? (
          <span
            className="rounded border px-2 py-0.5 font-blender-medium text-type-caption uppercase tracking-widest"
            style={{
              color: 'var(--primary)',
              borderColor: 'var(--primary)',
              boxShadow: '0 0 12px color-mix(in srgb, var(--primary) 35%, transparent)',
            }}
          >
            PRO
          </span>
        ) : (
          <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
            {completedCount} / {PRO_UNLOCK_AT}
          </span>
        )}
      </div>

      <div className="space-y-3 bg-(--color-darkbase) px-4 py-4">
        {/* Challenge tiles */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {challenges.map((c) => (
            <div
              key={c.id}
              title={c.description}
              className={`flex items-center gap-1.5 rounded border px-2 py-2 transition-all duration-300 ${
                c.completed ? 'border-transparent' : 'border-lines-hover opacity-45'
              }`}
              style={
                c.completed
                  ? {
                      borderColor: 'color-mix(in srgb, var(--primary) 45%, transparent)',
                      background: 'color-mix(in srgb, var(--primary) 9%, transparent)',
                    }
                  : undefined
              }
            >
              {c.completed ? (
                <Check size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} strokeWidth={2.5} />
              ) : (
                <Lock size={11} className="shrink-0 text-text-muted" strokeWidth={2} />
              )}
              <span
                className="truncate font-blender-medium text-type-caption uppercase tracking-widest"
                style={{ color: c.completed ? 'var(--primary)' : undefined }}
              >
                {c.label}
              </span>
            </div>
          ))}
        </div>

        {/* Progress / unlocked state */}
        {!isUnlocked ? (
          <div>
            <div className="relative h-2 w-full overflow-hidden rounded-full border border-lines-hover bg-(--color-base)">
              <div
                className="relative h-full overflow-hidden rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(progressPct, 2)}%`,
                  background: 'var(--primary)',
                  boxShadow: '0 0 10px color-mix(in srgb, var(--primary) 55%, transparent)',
                }}
              >
                <div className="absolute inset-y-0 left-0 w-1/3 animate-shimmer bg-linear-to-r from-transparent via-white/45 to-transparent" />
              </div>
            </div>
            <p className="mt-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
              ещё {formatRemainingChallenges(remaining)}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-lines-hover pt-2">
            <span
              className="font-blender-medium text-type-caption uppercase tracking-widest"
              style={{ color: 'var(--primary)' }}
            >
              ▲ PRO-функции активны — экспорт сводки доступен
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
