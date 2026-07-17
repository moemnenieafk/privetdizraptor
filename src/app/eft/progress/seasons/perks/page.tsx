import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CURRENT_SEASON, getSeason } from '@/data/eft-seasons';
import { SeasonPerkBuilder } from '@/components/features/seasons/SeasonPerkBuilder';
import { SeasonBuildGallery } from '@/components/features/seasons/SeasonBuildGallery';

export const metadata: Metadata = {
  title: 'Конструктор перков',
  description:
    'Соберите билд сезонных модификаторов Escape from Tarkov: бюджет очков, взаимоисключения, готовые стратегии и ссылка-шаринг.',
};

interface Props {
  searchParams: Promise<{ s?: string }>;
}

export default async function SeasonPerksPage({ searchParams }: Props) {
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

        <header className="mb-7 border-b border-lines-hover pb-5">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Сезон {season.number} · {season.name}
          </span>
          <h1 className="mt-1 font-blender-medium text-2xl uppercase tracking-widest text-text-primary">
            Конструктор перков
          </h1>
          <p className="mt-2 max-w-2xl font-blender-book text-sm leading-relaxed text-text-secondary">
            Старт — 0 очков. Негативные модификаторы дают очки, позитивные их тратят. Баланс
            должен остаться неотрицательным. Взаимоисключающие перки конструктор блокирует сам.
          </p>
        </header>

        <SeasonBuildGallery season={season} />

        <div id="season-builder" className="scroll-mt-20">
          <SeasonPerkBuilder season={season} />
        </div>
      </div>
    </main>
  );
}
