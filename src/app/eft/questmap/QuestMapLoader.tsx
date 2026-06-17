'use client';

import dynamic from 'next/dynamic';
import type { TaskRaw } from '@/types/quest';

const QuestMapClient = dynamic(
  () => import('@/app/eft/progress/quests/QuestMapClient'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full flex-1 animate-pulse bg-card-menu" />
    ),
  },
);

export function QuestMapLoader({ initialTasks }: { initialTasks: TaskRaw[] }) {
  return <QuestMapClient initialTasks={initialTasks} />;
}
