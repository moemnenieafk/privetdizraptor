import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBuildDefs } from '@/db/build-defs';
import { decodeBuild } from '@/lib/build-share';
import { buildFocus } from '@/lib/build-focus';
import { buildTotal, formatRub } from '@/lib/build-price';
import { calcBuild, calcDelta, type BuildNode } from '@/lib/weapon-build';
import { SharedBuildView } from '@/components/features/loadouts/SharedBuildView';

// Снэпшот сборки по ссылке. Всё дерево лежит в самом URL — БД под сборку не нужна,
// поделиться можно с бесплатного тира и без регистрации.
//
// Цены и статы считаются НА МОМЕНТ ОТКРЫТИЯ: друг видит актуальную стоимость, а не ту,
// что была у автора неделю назад.

interface Props {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ n?: string }>;
}

// Сборка приходит из URL, кэшировать нечего: у каждой ссылки свой код.
export const dynamic = 'force-dynamic';

/** База + все модули из дерева — по ним добираем определения и цены. */
function collectIds(node: BuildNode, acc: Set<string>): Set<string> {
  acc.add(node.itemId);
  for (const child of Object.values(node.mods)) collectIds(child, acc);
  return acc;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ code }, { n }] = await Promise.all([params, searchParams]);

  const tree = decodeBuild(code);
  if (!tree) return { title: 'Сборка не найдена — ЦТА' };

  const ids = [...collectIds(tree, new Set())];
  const bundle = await getBuildDefs(ids);

  const index = new Map(bundle.defs.map((d) => [d.id, d]));
  const result = calcBuild(tree, index);
  const delta = calcDelta(tree, index);

  const baseName = bundle.names[tree.itemId] ?? 'Оружие';
  const title = n?.trim() || `${baseName} — сборка`;

  const total = buildTotal(tree.itemId, result, bundle.prices);
  const focus = buildFocus(result, delta, index, total.total > 0 ? total.total : null);

  const description = `${focus.label} · эргономика ${result.stats.ergonomics} · отдача ${result.stats.recoilSum} · ${formatRub(total.total)}`;

  return {
    title: `${title} — ЦТА`,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SharedBuildPage({ params, searchParams }: Props) {
  const [{ code }, { n }] = await Promise.all([params, searchParams]);

  const tree = decodeBuild(code);
  if (!tree) notFound();

  const ids = [...collectIds(tree, new Set())];
  const bundle = await getBuildDefs(ids);

  // Базы нет в оружейном слое — ссылка битая или ствол вырезали из игры.
  if (!bundle.defs.some((d) => d.id === tree.itemId && d.kind === 'weapon')) notFound();

  const baseName = bundle.names[tree.itemId] ?? 'Оружие';
  const buildName = n?.trim() || `${baseName} — сборка`;

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <SharedBuildView
          tree={tree}
          baseItemId={tree.itemId}
          baseName={baseName}
          buildName={buildName}
          defs={bundle.defs}
          presets={bundle.presets}
          names={bundle.names}
          prices={bundle.prices}
        />
      </div>
    </main>
  );
}
