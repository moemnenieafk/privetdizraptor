'use client';

// Просмотр снэпшота: то, что видит друг по ссылке. Сборка целиком приехала в URL,
// БД для неё не нужна — но ЦЕНЫ подтягиваются свежие, на момент открытия.
//
// Главная кнопка — «Открыть в конструкторе»: снэпшот бесполезен, если его нельзя
// доработать под себя. Это же и воронка: человек попадает в конструктор ЦТА.
import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { useBuildStore } from '@/store/useBuildStore';
import { Paywall } from '@/components/features/subscription/Paywall';
import { BuildMedia } from '@/components/features/loadouts/BuildMedia';
import { BuildStatsPanel } from '@/components/features/loadouts/BuildStatsPanel';
import { BuildSummary } from '@/components/features/loadouts/BuildSummary';
import { ShoppingList } from '@/components/features/loadouts/ShoppingList';
import { calcBuild, calcDelta, type BuildItemDef, type BuildNode } from '@/lib/weapon-build';
import type { PresetRef } from '@/lib/build-media';
import type { BuildPrice } from '@/lib/build-price';

interface SharedBuildViewProps {
  tree: BuildNode;
  baseItemId: string;
  baseName: string;
  buildName: string;
  defs: BuildItemDef[];
  presets: PresetRef[];
  names: Record<string, string>;
  prices: Record<string, BuildPrice>;
}

export function SharedBuildView({
  tree,
  baseItemId,
  baseName,
  buildName,
  defs,
  presets,
  names,
  prices,
}: SharedBuildViewProps) {
  const router = useRouter();
  const startBuild = useBuildStore((s) => s.startBuild);
  const putMod = useBuildStore((s) => s.putMod);

  const index = useMemo(() => new Map(defs.map((d) => [d.id, d])), [defs]);
  const result = useMemo(() => calcBuild(tree, index), [tree, index]);
  const delta = useMemo(() => calcDelta(tree, index), [tree, index]);

  const nameOf = (id: string): string => names[id] ?? id;

  // Переносим дерево в стор конструктора: ставим каждый модуль по его пути.
  const openInBuilder = () => {
    startBuild(baseItemId);

    const walk = (node: BuildNode, path: string[]) => {
      for (const [slotNameId, child] of Object.entries(node.mods)) {
        putMod(path, slotNameId, child.itemId);
        walk(child, [...path, slotNameId]);
      }
    };
    walk(tree, []);

    router.push(`/eft/progress/loadouts/add?base=${baseItemId}`);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
          Сборка из ЦТА
        </span>
        <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary md:text-3xl">
          {buildName}
        </h1>
        <p className="font-blender-book text-sm text-text-secondary">{baseName}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <BuildMedia
          baseItemId={baseItemId}
          baseName={baseName}
          result={result}
          presets={presets}
          nameOf={nameOf}
        />
        <BuildStatsPanel delta={delta} issues={result.issues} />
      </div>

      <BuildSummary
        baseItemId={baseItemId}
        baseName={baseName}
        tree={tree}
        result={result}
        delta={delta}
        index={index}
        prices={prices}
        nameOf={nameOf}
        buildName={buildName}
      />

      <button
        type="button"
        onClick={openInBuilder}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-5 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
      >
        <Wrench className="h-4 w-4" aria-hidden="true" />
        Открыть в конструкторе
      </button>

      {result.stats.modCount > 0 && (
        <Paywall feature="weapon_builds">
          <ShoppingList result={result} prices={prices} nameOf={nameOf} />
        </Paywall>
      )}

      <Link
        href="/eft/progress/loadouts/find"
        className="text-center font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:text-(--primary)"
      >
        Смотреть другие сборки в ЦТА →
      </Link>
    </div>
  );
}
