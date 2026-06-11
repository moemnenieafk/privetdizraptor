import { PageHeader } from '@/components/ui/PageHeader';
import { AchievementsClient } from './AchievementsClient';

async function getAchievements() {
  try {
    const response = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            achievements(lang: ru) {
              id
              name
              description
              hidden
              playersCompletedPercent
            }
          }
        `
      }),
      next: { revalidate: 3600 } // Кэшируем результаты на 1 час
    });

    const { data } = await response.json();
    return data.achievements || [];
  } catch (error) {
    console.error('Ошибка загрузки достижений с tarkov.dev:', error);
    return [];
  }
}

export default async function AchievementsPage() {
  const achievements = await getAchievements();

  return (
    <main className="flex w-full flex-col items-center justify-start pt-[28px] pb-[56px] animate-[fade-in_0.5s_ease-out_both] min-h-[70vh]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0 mx-auto">
        <PageHeader pageId="eft-progress-achievements" />
        <AchievementsClient initialData={achievements} />
      </div>
    </main>
  );
}
