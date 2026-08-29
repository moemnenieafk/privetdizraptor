import { Suspense } from 'react';
import { getQuestMapTasks } from '@/lib/eft-api';
import { getBartersByQuest } from '@/db/barter-quest';
import { QuestMapLoader } from './QuestMapLoader';

// Рендер в рантайме: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function QuestMapPage() {
  const [tasks, bartersByQuest] = await Promise.all([getQuestMapTasks(), getBartersByQuest()]);

  return (
    <Suspense fallback={<div className="flex-1 animate-pulse bg-card-menu" />}>
      <QuestMapLoader initialTasks={tasks} bartersByQuest={bartersByQuest} />
    </Suspense>
  );
}
