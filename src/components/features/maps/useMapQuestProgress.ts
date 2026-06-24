'use client';

import { useMemo } from 'react';
import { useQuestStore } from '@/store/useQuestStore';

/** Прогресс по квестам, привязанным к карте: завершённые из стора ↔ список id карты. */
export function useMapQuestProgress(questIds: string[]) {
  const completed = useQuestStore((s) => s.completedQuests);
  return useMemo(() => {
    const set = new Set(completed);
    const done = questIds.reduce((n, id) => (set.has(id) ? n + 1 : n), 0);
    const total = questIds.length;
    return { total, completed: done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [questIds, completed]);
}
