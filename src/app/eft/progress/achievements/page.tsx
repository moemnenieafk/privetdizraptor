import { PageHeader } from '@/components/ui/PageHeader';
import { AchievementsClient } from './AchievementsClient';
import { getEftAchievements } from '@/db/landing';
import { PveNotice } from '@/components/features/adaptive/PveNotice';

export default async function AchievementsPage() {
  // Достижения зеркалятся из tarkov.dev кроном; читаем нашу БД (рантайм без внешнего API).
  const achievements = await getEftAchievements();

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both] min-h-[70vh]">
      <div className="w-full max-w-275 px-4 xl:px-0 mx-auto">
        <PageHeader pageId="eft-progress-achievements" />
        <PveNotice>Достижения за PvP-убийства в режиме PvE не засчитываются.</PveNotice>
        <AchievementsClient initialData={achievements} />
      </div>
    </main>
  );
}
