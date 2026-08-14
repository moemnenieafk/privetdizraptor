import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CURRENT_SEASON, getSeason } from '@/data/eft-seasons';
import { BP_ALL_REWARDS, BP_DOC_ORDER, BP_PAGES } from '@/data/eft-battlepass';
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

  return (
    <main className="flex w-full flex-col items-center pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <Link
          href="/eft/progress/seasons"
          className="mb-5 inline-flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Сезоны
        </Link>

        <header className="mb-6 flex flex-col gap-2">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Сезон {season.number} · {season.name} · Боевой пропуск
          </span>
          <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary sm:text-3xl">
            BATTLEPASS Трекер
          </h1>
          <p className="max-w-3xl font-blender-book text-sm leading-relaxed text-text-muted">
            {BP_PAGES.length} страниц, {BP_ALL_REWARDS.length} наград и {BP_DOC_ORDER.length} типов
            документации. Документы — валюта Боевого Пропуска: находишь и выносишь их из рейда, тратишь
            на разблокировку наград. Отметь полученную награду — трекер вычтет её стоимость и покажет,
            сколько документации ещё собрать и где её лутать.
          </p>
        </header>

        <BattlePassTracker season={season} />
      </div>
    </main>
  );
}
