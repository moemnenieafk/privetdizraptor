import { Suspense } from 'react';
import { getQuestMapTasks } from '@/lib/eft-api';
import { QuestMapLoader } from './QuestMapLoader';

export default async function QuestMapPage() {
  const tasks = await getQuestMapTasks();

  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-card-menu" />}>
      <QuestMapLoader initialTasks={tasks} />
    </Suspense>
  );
}
