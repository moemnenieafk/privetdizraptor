import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CURRENT_SEASON } from '@/data/eft-seasons';
import { decodeBuild } from '@/lib/season-points';
import { SeasonPerkBuilder } from '@/components/features/seasons/SeasonPerkBuilder';

// Билд перков целиком лежит в URL — БД под шаринг не нужна, поделиться можно без
// регистрации. Открывший видит расклад и сразу может править его как свой.
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const ids = decodeBuild(CURRENT_SEASON, code);
  return {
    title: `Билд перков · ${CURRENT_SEASON.name}`,
    description: `Готовый набор из ${ids.length} сезонных модификаторов — откройте и настройте под себя.`,
  };
}

export default async function SharedSeasonBuildPage({ params }: Props) {
  const { code } = await params;
  const ids = decodeBuild(CURRENT_SEASON, code);

  return (
    <main className="flex w-full flex-col items-center pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <Link
          href="/eft/progress/seasons/perks"
          className="mb-5 inline-flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Свой конструктор
        </Link>

        <header className="mb-7 border-b border-lines-hover pb-5">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Общий билд · Сезон {CURRENT_SEASON.number} · {CURRENT_SEASON.name}
          </span>
          <h1 className="mt-1 font-blender-medium text-2xl uppercase tracking-widest text-text-primary">
            Билд перков
          </h1>
          <p className="mt-2 max-w-2xl font-blender-book text-sm leading-relaxed text-text-secondary">
            Расклад открыт в конструкторе — меняйте перки, и он станет вашим.
          </p>
        </header>

        <SeasonPerkBuilder season={CURRENT_SEASON} initialSelection={ids} />
      </div>
    </main>
  );
}
