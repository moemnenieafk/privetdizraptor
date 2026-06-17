'use client';

import { Check, Lock } from 'lucide-react';
import { useGamificationStore } from '@/store/useGamificationStore';
import { computeProStatus, formatRemainingChallenges, PRO_UNLOCK_AT } from '@/types/gamification';

export function ProMetaProgress() {
  const xp = useGamificationStore((s) => s.xp);
  const confirmedBarterIds = useGamificationStore((s) => s.confirmedBarterIds);
  const badges = useGamificationStore((s) => s.badges);

  const { challenges, completedCount, isUnlocked } = computeProStatus(xp, confirmedBarterIds, badges);
  const progressPct = Math.min(100, (completedCount / PRO_UNLOCK_AT) * 100);
  const remaining = PRO_UNLOCK_AT - completedCount;

  return (
    <div className="mt-6 border border-lines-hover">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-lines-hover bg-card-menu">
        <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
          Мета-прогресс · PRO-доступ
        </span>
        {isUnlocked ? (
          <span
            className="font-blender-medium text-[10px] uppercase tracking-widest px-2 py-0.5 border"
            style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
          >
            PRO
          </span>
        ) : (
          <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
            {completedCount} / {PRO_UNLOCK_AT}
          </span>
        )}
      </div>

      <div className="px-4 py-3 bg-(--color-darkbase) space-y-3">
        {/* Challenge tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {challenges.map((c) => (
            <div
              key={c.id}
              title={c.description}
              className={`flex items-center gap-1.5 px-2 py-1.5 border border-lines-hover ${
                c.completed ? '' : 'opacity-40'
              }`}
            >
              {c.completed ? (
                <Check size={9} style={{ color: 'var(--primary)', flexShrink: 0 }} strokeWidth={2.5} />
              ) : (
                <Lock size={9} className="text-text-muted shrink-0" strokeWidth={2} />
              )}
              <span
                className="font-blender-medium text-[9px] uppercase tracking-widest truncate"
                style={{ color: c.completed ? 'var(--primary)' : undefined }}
              >
                {c.label}
              </span>
            </div>
          ))}
        </div>

        {/* Progress bar + status */}
        {!isUnlocked ? (
          <div>
            <div className="h-0.5 bg-lines-hover overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: 'var(--primary)' }}
              />
            </div>
            <p className="mt-1 font-blender-medium text-[9px] uppercase text-text-muted">
              ещё {formatRemainingChallenges(remaining)}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1 border-t border-lines-hover">
            <span
              className="font-blender-medium text-[9px] uppercase tracking-widest"
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
