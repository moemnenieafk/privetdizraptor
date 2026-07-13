'use client';

// Решение квеста «Оружейник»: чеклист порогов + собранный солвером ствол + список
// покупок. Кнопка «Открыть в конструкторе» кладёт дерево в стор и уводит на /add —
// человек может доработать сборку под себя, а не копировать её руками.
//
// Список покупок — платный (weapon_builds = «Оперативник»). Чеклист и сама сборка
// бесплатны: они и есть витрина ценности, за деньги — удобство (где купить, почём).
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Wrench, X } from 'lucide-react';
import { useBuildStore } from '@/store/useBuildStore';
import { useSubscription } from '@/hooks/useSubscription';
import { Paywall } from '@/components/features/subscription/Paywall';
import { BuildMedia } from '@/components/features/loadouts/BuildMedia';
import { ShoppingList } from '@/components/features/loadouts/ShoppingList';
import { opSymbol, type GunsmithCheck } from '@/lib/gunsmith';
import { calcBuild, type BuildItemDef, type BuildNode } from '@/lib/weapon-build';
import type { PresetRef } from '@/lib/build-media';
import type { BuildPrice } from '@/db/build-prices';

interface Props {
  baseItemId: string;
  baseName: string;
  defs: BuildItemDef[];
  presets: PresetRef[];
  names: Record<string, string>;
  prices: Record<string, BuildPrice>;
  /** Дерево, собранное солвером. */
  tree: BuildNode;
  check: GunsmithCheck;
  price: number;
  solved: boolean;
  unpricedItemIds: string[];
}

const rub = (n: number): string => `${n.toLocaleString('ru-RU')} ₽`;

export function GunsmithSolution({
  baseItemId,
  baseName,
  defs,
  presets,
  names,
  prices,
  tree,
  check,
  price,
  solved,
  unpricedItemIds,
}: Props) {
  const router = useRouter();
  const { tier } = useSubscription();
  const startBuild = useBuildStore((s) => s.startBuild);
  const putMod = useBuildStore((s) => s.putMod);

  const index = useMemo(() => new Map(defs.map((d) => [d.id, d])), [defs]);
  const result = useMemo(() => calcBuild(tree, index), [tree, index]);
  const nameOf = (id: string): string => names[id] ?? id;

  const paid = tier !== 'free';

  // Переносим дерево солвера в стор конструктора: обходим рекурсивно и ставим
  // каждый модуль по его пути. Дешевле, чем городить отдельный setDraft в сторе.
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
      {/* Вердикт */}
      <div
        className={`flex items-center gap-3 rounded-sm border p-4 ${
          solved
            ? 'border-success/40 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)]'
            : 'border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
        }`}
      >
        {solved ? (
          <Check className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 text-(--primary)" aria-hidden="true" />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            {solved ? 'Сборка проходит квест' : 'Сборку дожать не удалось'}
          </span>
          <span className="font-blender-book text-xs text-text-secondary">
            {solved
              ? 'Самая дешёвая конфигурация по ценам последнего синка'
              : 'Пороги не сходятся на доступных модулях — соберите вручную в конструкторе'}
          </span>
        </div>
        {price > 0 && (
          <span className="shrink-0 font-blender-medium text-base text-(--primary)">
            {rub(price)}
          </span>
        )}
      </div>

      {/* Чеклист порогов */}
      <section className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Требования квеста
        </h2>

        <div className="flex flex-col gap-2">
          {check.checks.map((c) => (
            <div
              key={c.rawName}
              className="flex items-center gap-3 border-b border-lines-hover pb-2 last:border-0"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                {c.passed === true && <Check className="h-4 w-4 text-success" aria-hidden="true" />}
                {c.passed === false && <X className="h-4 w-4 text-danger" aria-hidden="true" />}
                {c.passed === null && (
                  <AlertTriangle
                    className="h-4 w-4 text-text-secondary"
                    aria-hidden="true"
                  />
                )}
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-blender-book text-sm text-text-primary">
                  {c.label} {opSymbol(c.op)} {c.value}
                </span>
                {c.passed === null && c.manualReason && (
                  <span className="font-blender-book text-xs text-text-secondary">
                    {c.manualReason}
                  </span>
                )}
              </span>

              {c.actual !== null && (
                <span
                  className={`shrink-0 font-blender-medium text-sm ${
                    c.passed ? 'text-success' : 'text-danger'
                  }`}
                >
                  {c.actual}
                </span>
              )}
            </div>
          ))}
        </div>

        {check.missingItemIds.length > 0 && (
          <div className="rounded-xs border border-danger/40 p-3">
            <span className="font-blender-medium text-xs uppercase tracking-widest text-danger">
              Не хватает обязательных деталей
            </span>
            <ul className="mt-1 flex flex-col gap-1">
              {check.missingItemIds.map((id) => (
                <li key={id} className="font-blender-book text-xs text-text-secondary">
                  {nameOf(id)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {check.unknown.length > 0 && (
          <div className="rounded-xs border border-(--primary)/30 p-3">
            <span className="font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
              Не распознали требование — проверьте в игре
            </span>
            <ul className="mt-1 flex flex-col gap-1">
              {check.unknown.map((u) => (
                <li key={u.rawName} className="font-blender-book text-xs text-text-secondary">
                  {u.rawName} {u.rawCompare} {u.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Сборка */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <BuildMedia
          baseItemId={baseItemId}
          baseName={baseName}
          result={result}
          presets={presets}
          nameOf={nameOf}
        />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={openInBuilder}
            className="flex h-11 items-center justify-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-5 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
          >
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Открыть в конструкторе
          </button>

          <div className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-4">
            <Stat label="Эргономика" value={result.stats.ergonomics} />
            <Stat label="Сумма отдачи" value={result.stats.recoilSum} />
            <Stat label="Вес" value={`${result.stats.weight} кг`} />
            {result.stats.capacity != null && (
              <Stat label="Магазин" value={`${result.stats.capacity} патр.`} />
            )}
            <Stat label="Модулей" value={result.stats.modCount} />
          </div>

          {unpricedItemIds.length > 0 && (
            <p className="font-blender-book text-xs text-text-secondary">
              {unpricedItemIds.length} детал(и) нет в продаже — искать в рейде.
            </p>
          )}
        </div>
      </div>

      {/* Список покупок — за пэйволом */}
      {paid ? (
        <ShoppingList result={result} prices={prices} nameOf={nameOf} />
      ) : (
        <Paywall feature="weapon_builds">
          <div />
        </Paywall>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-lines-hover pb-2 last:border-0">
      <span className="font-blender-book text-sm text-text-secondary">{label}</span>
      <span className="font-blender-medium text-base text-text-primary">{value}</span>
    </div>
  );
}