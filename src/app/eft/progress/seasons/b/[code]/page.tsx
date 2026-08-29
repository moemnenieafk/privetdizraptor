import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CURRENT_SEASON } from '@/data/eft-seasons';
import { findCuratedBuildByCode, VIBE_META } from '@/data/season-builds';
import { decodeBuild, encodeBuild } from '@/lib/season-points';
import { getMe } from '@/lib/auth/me';
import { getSeasonBuildBySlug, getSeasonBuildState } from '@/db/season-build-social';
import { SeasonPerkBuilder } from '@/components/features/seasons/SeasonPerkBuilder';
import { SeasonBuildHero } from '@/components/features/seasons/SeasonBuildHero';
import { ShortenBuildUrl } from '@/components/features/seasons/ShortenBuildUrl';
import { EntityComments } from '@/components/features/comments/EntityComments';

// Билд перков целиком лежит в URL — БД под шаринг не нужна, поделиться можно без
// регистрации. Открывший видит расклад и сразу может править его как свой.
// Соц-слой (реакции + обсуждение) — поверх: сборка лениво канонизируется в строку
// season_builds, ключ обсуждения = её короткий slug (docs/decisions/seasons-build-social.md).
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ code: string }>;
}

// Параметр — это либо dot-код сборки (encodeBuild), либо короткий slug (наша короткая
// ссылка / лента модерации). Код декодируется в непустой билд; slug — нет. Поэтому
// пробуем как КОД, и лишь при пустом результате резолвим slug→code.
async function resolveBuild(
  param: string,
): Promise<{ ids: string[]; canonCode: string | null }> {
  const direct = decodeBuild(CURRENT_SEASON, param);
  if (direct.length > 0) return { ids: direct, canonCode: encodeBuild(direct) };

  const row = await getSeasonBuildBySlug(param);
  if (row) {
    const ids = decodeBuild(CURRENT_SEASON, row.code);
    if (ids.length > 0) return { ids, canonCode: encodeBuild(ids) };
  }
  return { ids: [], canonCode: null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const { ids } = await resolveBuild(code);
  return {
    title: `Билд перков · ${CURRENT_SEASON.name}`,
    description: `Готовый набор из ${ids.length} сезонных модификаторов — откройте и настройте под себя.`,
  };
}

export default async function SharedSeasonBuildPage({ params }: Props) {
  const { code } = await params;
  const { ids, canonCode } = await resolveBuild(code);

  const me = await getMe();
  const social = canonCode
    ? await getSeasonBuildState(CURRENT_SEASON.slug, canonCode, me?.id ?? null)
    : null;

  // Совпала ли сборка с курируемым билдом → баннер+имя; иначе «Своя сборка».
  const curated = canonCode ? findCuratedBuildByCode(CURRENT_SEASON.slug, canonCode) : undefined;

  return (
    <main className="flex w-full flex-col items-center pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        {social && <ShortenBuildUrl slug={social.slug} />}

        <Link
          href="/eft/progress/seasons/perks"
          className="mb-5 inline-flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Свой конструктор
        </Link>

        {social && canonCode ? (
          <SeasonBuildHero
            code={canonCode}
            loggedIn={me !== null}
            up={social.up}
            down={social.down}
            myValue={social.myValue}
            banner={curated?.banner}
            cardTitle={curated?.name ?? 'Своя сборка'}
            cardAccent={curated ? VIBE_META[curated.vibe].color : 'var(--color-lines-hover)'}
            logoUrl={CURRENT_SEASON.logoUrl}
            seasonName={CURRENT_SEASON.name}
            seasonAccent={CURRENT_SEASON.accent}
          />
        ) : (
          // Битый/пустой код — прежняя текстовая шапка без соц-слоя.
          <header className="mb-7 border-b border-lines-hover pb-5">
            <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              Общий билд · Сезон {CURRENT_SEASON.number} · {CURRENT_SEASON.name}
            </span>
            <h1 className="mt-1 font-blender-medium text-2xl uppercase tracking-widest text-text-primary">
              Билд перков
            </h1>
          </header>
        )}

        <SeasonPerkBuilder season={CURRENT_SEASON} initialSelection={ids} />

        {/* Обсуждение под сборкой — общий полиморфный слой, ключ = slug сборки. */}
        {social && <EntityComments type="season-build" id={social.slug} />}
      </div>
    </main>
  );
}
