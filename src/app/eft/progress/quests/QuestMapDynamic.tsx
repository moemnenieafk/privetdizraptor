'use client';

import dynamic from 'next/dynamic';
import type { TaskRaw } from '@/types/quest';

const QuestMapClient = dynamic(() => import('./QuestMapClient'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-280px)] animate-pulse rounded-xl bg-(--color-card-menu)" />
  ),
});

export default function QuestMapDynamic({ initialTasks }: { initialTasks: TaskRaw[] }) {
  return <QuestMapClient initialTasks={initialTasks} />;
}
