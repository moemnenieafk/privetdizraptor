import { getQuestMapTasks } from '@/lib/eft-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { ItemTrackerClient } from './ItemTrackerClient';

export const metadata = { title: 'Трекер Предметов — CTA' };

export default async function ItemTrackerPage() {
  const tasks = await getQuestMapTasks();
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-progress-tracker" />
        <ItemTrackerClient initialTasks={tasks} />
      </div>
    </main>
  );
}
