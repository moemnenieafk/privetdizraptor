import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CURRENT_SEASON, getSeason } from '@/data/eft-seasons';
import { SeasonPerkBuilder } from '@/components/features/seasons/SeasonPerkBuilder';
import { SeasonBuildGallery, SeasonBuildList } from '@/components/features/seasons/SeasonBuildGallery';
import { SeasonIntro } from '@/components/features/seasons/SeasonIntro';

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

        <SeasonIntro season={season} />

        <header className="mt-7 mb-7 border-b border-lines-hover pb-5">
          <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary">
            Конструктор перков
          </h1>
          <p className="mt-2 max-w-2xl font-blender-book text-sm leading-relaxed text-text-secondary">
            Добро пожаловать в конструктор перков! Соберите своего сезонного персонажа под свой
            стиль игры: негативные модификаторы дают очки, позитивные — их тратят, а баланс
            должен остаться неотрицательным (конфликтующие перки конструктор отсечёт сам).
            Понравился билд — поделитесь ссылкой с друзьями.
          </p>
        </header>

        <SeasonBuildGallery season={season} />

        <div id="season-builder" className="scroll-mt-20">
          <SeasonPerkBuilder season={season} />
        </div>

        <SeasonBuildList season={season} />
      </div>
    </main>
  );
}
