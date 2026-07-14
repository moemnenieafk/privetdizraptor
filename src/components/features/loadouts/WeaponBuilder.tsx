'use client';

// Оркестратор конструктора: собирает BuildItemIndex из плоского массива определений
// (Map через RSC-границу не проходит), держит черновик в useBuildStore, склеивает
// медиа / статы / дерево слотов / пикер / сводку (уклон + цена + шаринг).
//
// Пикер — единственное модальное состояние, живёт здесь: канвас только сообщает
// «открой слот X по пути Y», выбор возвращается в стор.
import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save, Undo2 } from 'lucide-react';
import { useBuildStore } from '@/store/useBuildStore';
import { useBuildQuota } from '@/hooks/useBuildQuota';
import { Paywall } from '@/components/features/subscription/Paywall';
import { BuildMedia, BuildMediaSkeleton } from '@/components/features/loadouts/BuildMedia';
import { BuildCanvas } from '@/components/features/loadouts/BuildCanvas';
import { BuildStatsPanel } from '@/components/features/loadouts/BuildStatsPanel';
import { BuildSummary } from '@/components/features/loadouts/BuildSummary';
import { ShoppingList } from '@/components/features/loadouts/ShoppingList';
import { ModPicker } from '@/components/features/loadouts/ModPicker';
import { calcBuild, calcDelta, type BuildItemDef } from '@/lib/weapon-build';
import type { PresetRef } from '@/lib/build-media';
import type { BuildPrice } from '@/lib/build-price';

/** Какой слот сейчас открыт в пикере. path — цепочка slotNameId от корня до владельца слота. */
export interface OpenSlotTarget {
  path: string[];
  slotNameId: string;
  slotName: string;
  allowedItemIds: string[];
  /** Что стоит в слоте сейчас (для подсветки и кнопки «Снять»). */
  currentItemId: string | null;
}

interface WeaponBuilderProps {
  baseItemId: string;
  baseName: string;
  defs: BuildItemDef[];
  presets: PresetRef[];
  names: Record<string, string>;
  /** Цены всех совместимых деталей — считает сервер, чтобы клиент не дёргал API на каждый мод. */
  prices: Record<string, BuildPrice>;
}

export function WeaponBuilder({
  baseItemId,
  baseName,
  defs,
  presets,
  names,
  prices,
}: WeaponBuilderProps) {
  const draft = useBuildStore((s) => s.draft);
  const startBuild = useBuildStore((s) => s.startBuild);
  const putMod = useBuildStore((s) => s.putMod);
  const undo = useBuildStore((s) => s.undo);
  const historyLen = useBuildStore((s) => s.history.length);
  const saveDraft = useBuildStore((s) => s.saveDraft);

  const quota = useBuildQuota();
  const [picker, setPicker] = useState<OpenSlotTarget | null>(null);
  const [name, setName] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const index = useMemo(() => new Map(defs.map((d) => [d.id, d])), [defs]);

  // Черновик пуст или собран на ДРУГОМ стволе (пришли по ссылке с ?base=…) → начинаем заново.
  useEffect(() => {
    if (!draft || draft.itemId !== baseItemId) startBuild(baseItemId);
  }, [draft, baseItemId, startBuild]);

  const nameOf = (id: string): string => names[id] ?? id;

  // Первый рендер до гидрации стора: черновика ещё нет — показываем скелетон, не спиннер.
  if (!draft || draft.itemId !== baseItemId) {
    return (
      <div className="flex w-full flex-col gap-6">
        <BuildMediaSkeleton />
        <div className="h-40 w-full animate-pulse rounded-sm bg-card-menu" aria-hidden="true" />
      </div>
    );
  }

  const result = calcBuild(draft, index);
  const delta = calcDelta(draft, index);

  const handleSave = () => {
    const title = name.trim() || `${baseName} — сборка`;
    const id = saveDraft(title);
    if (id) setSavedAt(Date.now());
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Шапка */}
      <header className="flex flex-col gap-2">
        <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary md:text-3xl">
          {baseName}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={historyLen === 0}
            className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:pointer-events-none disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Отменить
          </button>

          <button
            type="button"
            onClick={() => startBuild(baseItemId)}
            className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Сбросить
          </button>
        </div>
      </header>

      {/* Медиа + статы */}
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

      {/* Уклон + цена + шаринг */}
      <BuildSummary
        baseItemId={baseItemId}
        baseName={baseName}
        tree={draft}
        result={result}
        delta={delta}
        index={index}
        prices={prices}
        nameOf={nameOf}
        buildName={name.trim() || undefined}
      />

      {/* Дерево слотов */}
      <BuildCanvas
        node={draft}
        index={index}
        path={[]}
        nameOf={nameOf}
        onOpenSlot={setPicker}
      />

      {/* Список покупок — платный: сама сборка и её цена бесплатны, удобство «где купить» нет */}
      {result.stats.modCount > 0 && (
        <Paywall feature="weapon_builds">
          <ShoppingList result={result} prices={prices} nameOf={nameOf} />
        </Paywall>
      )}

      {/* Сохранение */}
      <section className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            Сохранить сборку
          </h2>
          <span className="font-blender-medium text-xs text-text-secondary">{quota.label}</span>
        </div>

        {quota.canSave ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${baseName} — сборка`}
              className="h-11 flex-1 rounded-sm border border-lines-hover bg-(--color-darkbase) px-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSave}
              className="flex h-11 items-center justify-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-5 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Сохранить
            </button>
          </div>
        ) : (
          <Paywall feature="weapon_builds">
            <div />
          </Paywall>
        )}

        {savedAt !== null && (
          <p className="font-blender-book text-xs text-success">
            Сохранено. Сборка в разделе «Мои сборки».
          </p>
        )}
      </section>

      {/* Пикер модуля */}
      {picker && (
        <ModPicker
          target={picker}
          index={index}
          onClose={() => setPicker(null)}
          onPick={(itemId) => {
            putMod(picker.path, picker.slotNameId, itemId);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
