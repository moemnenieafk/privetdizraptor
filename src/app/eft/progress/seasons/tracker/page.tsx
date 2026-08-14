import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CURRENT_SEASON, getSeason } from '@/data/eft-seasons';
import { BattlePassTracker } from '@/components/features/seasons/BattlePassTracker';

export const metadata: Metadata = {
  title: 'BATTLEPASS Трекер',
  description:
    'Трекер наград и документации Боевого Пропуска Сезона 1 «KORD BREACH» в Escape from Tarkov: отметьте полученные награды — трекер посчитает, сколько документации ещё нужно налутать и на каких картах её искать.',
};

interface Props {
  searchParams: Promise<{ s?: string }>;
}

export default async function BattlePassTrackerPage({ searchParams }: Props) {
  const { s } = await searchParams;
  const season = s ? getSeason(s) : CURRENT_SEASON;
  if (!season) notFound();

  // Заголовок/навигацию/крошки даёт layout раздела (SectionLayoutNav). Здесь — только контент трекера.
  return (
    <main className="flex w-full flex-col items-center pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <BattlePassTracker season={season} />
      </div>
    </main>
  );
}
