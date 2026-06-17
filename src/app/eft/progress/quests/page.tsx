import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { getQuestMapTasks } from '@/lib/eft-api';
import QuestMapDynamic from './QuestMapDynamic';

export default async function QuestsMapPage() {
  const tasks = await getQuestMapTasks();

  return (
    <main className="flex w-full flex-col animate-[fade-in_0.5s_ease-out_both] pt-7 pb-0">
      <div className="w-full max-w-275 px-4 xl:px-0 mx-auto">
        <PageHeader pageId="eft-progress-quests" />
      </div>
      <Suspense
        fallback={
          <div className="w-full h-[calc(100vh-280px)] animate-pulse rounded-xl bg-(--color-card-menu) mx-auto max-w-275 px-4 xl:px-0" />
        }
      >
        <QuestMapDynamic initialTasks={tasks} />
      </Suspense>
    </main>
  );
}
