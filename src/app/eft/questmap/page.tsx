import { Suspense } from 'react';
import { getQuestMapTasks } from '@/lib/eft-api';
import { getBartersByQuest } from '@/db/barter-quest';
import { QuestMapLoader } from './QuestMapLoader';

export default async function QuestMapPage() {
  const [tasks, bartersByQuest] = await Promise.all([getQuestMapTasks(), getBartersByQuest()]);

  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-card-menu" />}>
      <QuestMapLoader initialTasks={tasks} bartersByQuest={bartersByQuest} />
    </Suspense>
  );
}
