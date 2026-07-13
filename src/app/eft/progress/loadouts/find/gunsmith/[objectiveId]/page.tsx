import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBuildContext } from '@/db/weapons';
import { getGunsmithSpec } from '@/db/weapons';
import { getGunsmithListItem } from '@/db/gunsmith-list';
import { getBuildPriceMap, priceOfFrom, type BuildPrice } from '@/db/build-prices';
import { solveQuest } from '@/lib/gunsmith-solver';
import { checkBuild } from '@/lib/gunsmith';
import { GunsmithSolution } from '@/components/features/loadouts/GunsmithSolution';
import type { BuildItemDef } from '@/lib/weapon-build';

// Страница одного квеста «Оружейник»: пороги + САМАЯ ДЕШЁВАЯ сборка, которая их проходит.
//
// Солвер крутится на сервере, а не в браузере: ему нужен полный индекс модулей ствола
// (BFS по дереву слотов) и карта цен. На телефоне это заметная работа, на сервере —
// доли секунды, а результат кэшируется на сутки вместе со страницей.
//
// Цены берём из нашей таблицы prices, поэтому «дешёвая» — по ценам последнего синка.
// Это честно и заметно лучше, чем у конкурентов: тир-листы вообще не знают, что
// сколько стоит СЕГОДНЯ.

interface Props {
  params: Promise<{ objectiveId: string }>;
}

export const revalidate = 86400;

export default async function GunsmithQuestPage({ params }: Props) {
  const { objectiveId } = await params;

  const [spec, listItem] = await Promise.all([
    getGunsmithSpec(objectiveId),
    getGunsmithListItem(objectiveId),
  ]);
  if (!spec || !listItem) notFound();

  const ctx = await getBuildContext(spec.baseItemId);
  if (!ctx) notFound();

  // Цены нужны только для того, что реально можно поставить на ЭТОТ ствол.
  const priceMap = await getBuildPriceMap([...ctx.index.keys()]);

  const solution = solveQuest({
    baseItemId: spec.baseItemId,
    index: ctx.index,
    priceOf: priceOfFrom(priceMap),
    spec: { thresholds: spec.thresholds, requiredItemIds: spec.requiredItemIds },
  });

  const check = checkBuild(solution.result, {
    thresholds: spec.thresholds,
    requiredItemIds: spec.requiredItemIds,
  });

  // Map → массивы: через RSC-границу Map не переживает сериализацию.
  const defs: BuildItemDef[] = [...ctx.index.values()];
  const prices: Record<string, BuildPrice> = Object.fromEntries(priceMap);

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <Link
          href="/eft/progress/loadouts/find"
          className="mb-5 inline-flex h-11 items-center font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:text-(--primary)"
        >
          ← Каталог сборок
        </Link>

        <header className="mb-6 flex flex-col gap-2">
          <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary md:text-3xl">
            {spec.taskName}
          </h1>
          <div className="flex flex-wrap gap-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
            {spec.traderName && <span>{spec.traderName}</span>}
            {spec.minPlayerLevel != null && <span>уровень {spec.minPlayerLevel}+</span>}
            <span>{ctx.base.name}</span>
          </div>
        </header>

        <GunsmithSolution
          baseItemId={spec.baseItemId}
          baseName={ctx.base.name}
          defs={defs}
          presets={ctx.presets}
          names={ctx.names}
          prices={prices}
          tree={solution.node}
          check={check}
          price={solution.price}
          solved={solution.solved}
          unpricedItemIds={solution.unpricedItemIds}
        />
      </div>
    </main>
  );
}