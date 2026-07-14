'use client';

// Список сохранённых сборок. Данные — в useBuildStore (localStorage), поэтому RSC здесь
// невозможен: сначала ждём гидрацию persist, потом одним POST'ом добираем определения
// предметов по id из деревьев. Загрузка — скелетоны, не спиннеры.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, Pencil, Plus, Trash2, Wrench, X } from 'lucide-react';
import { useBuildStore, type SavedBuild } from '@/store/useBuildStore';
import { useBuildQuota } from '@/hooks/useBuildQuota';
import { BuildMedia, BuildMediaSkeleton } from '@/components/features/loadouts/BuildMedia';
import { calcBuild, calcDelta, type BuildItemIndex, type BuildNode } from '@/lib/weapon-build';
import type { BuildDefsBundle, PresetRef } from '@/lib/build-media';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** База + все установленные модули и патрон из дерева. */
function collectIds(node: BuildNode, acc: Set<string>): void {
  acc.add(node.itemId);
  for (const child of Object.values(node.mods)) collectIds(child, acc);
}

export function MyLoadoutsClient() {
  const router = useRouter();

  const saved = useBuildStore((s) => s.saved);
  const loadBuild = useBuildStore((s) => s.loadBuild);
  const duplicateBuild = useBuildStore((s) => s.duplicateBuild);
  const renameBuild = useBuildStore((s) => s.renameBuild);
  const removeBuild = useBuildStore((s) => s.removeBuild);

  const quota = useBuildQuota();

  const [hydrated, setHydrated] = useState(false);
  const [bundle, setBundle] = useState<BuildDefsBundle | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [attempt, setAttempt] = useState(0);

  // persist гидрируется только на клиенте: до этого saved пуст, и без флага
  // мы бы мигнули пустым состоянием «сборок нет».
  useEffect(() => setHydrated(true), []);

  // Ключ запроса — отсортированные id: меняется только при правке состава сборок.
  const idsKey = useMemo(() => {
    const acc = new Set<string>();
    for (const b of saved) collectIds(b.tree, acc);
    return [...acc].sort().join(',');
  }, [saved]);

  useEffect(() => {
    if (!hydrated || idsKey === '') return;

    let alive = true;
    setState('loading');

    fetch('/api/eft/builds/defs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: idsKey.split(',') }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<BuildDefsBundle>;
      })
      .then((data) => {
        if (!alive) return;
        setBundle(data);
        setState('ready');
      })
      .catch(() => {
        if (alive) setState('error');
      });

    return () => {
      alive = false;
    };
  }, [hydrated, idsKey, attempt]);

  const index = useMemo<BuildItemIndex>(
    () => new Map((bundle?.defs ?? []).map((d) => [d.id, d])),
    [bundle],
  );

  const nameOf = (id: string): string => bundle?.names[id] ?? id;

  const list = useMemo(() => [...saved].sort((a, b) => b.updatedAt - a.updatedAt), [saved]);

  const handleEdit = (b: SavedBuild) => {
    loadBuild(b.id);
    router.push(`/eft/progress/loadouts/add?base=${b.baseItemId}`);
  };

  if (!hydrated) return <CardsSkeleton />;

  if (list.length === 0) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-sm border border-lines-hover bg-(--color-base) px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-(--primary)/40">
          <Wrench className="h-5 w-5 text-(--primary)" aria-hidden="true" />
        </div>
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Сохранённых сборок нет
        </h2>
        <p className="max-w-md font-blender-book text-sm text-text-secondary">
          Соберите ствол в конструкторе и нажмите «Сохранить» — сборка появится здесь
          вместе со статами и обвесом.
        </p>
        <Link
          href="/eft/progress/loadouts/add"
          className="flex h-11 items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Создать сборку
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          Слоты: <span className="text-(--primary)">{quota.label}</span>
        </p>

        <Link
          href="/eft/progress/loadouts/add"
          className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Новая сборка
        </Link>
      </div>

      {state === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-3">
          <p className="font-blender-book text-sm text-text-secondary">
            Не удалось загрузить оружейный справочник — статы и картинки недоступны.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="flex h-11 items-center rounded-xs border border-(--primary) px-3 font-blender-medium text-xs uppercase tracking-widest text-(--primary)"
          >
            Повторить
          </button>
        </div>
      )}

      {state !== 'ready' && state !== 'error' && <CardsSkeleton />}

      {state === 'ready' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map((b) => (
            <BuildCard
              key={b.id}
              build={b}
              index={index}
              presets={bundle?.presets ?? []}
              nameOf={nameOf}
              onEdit={() => handleEdit(b)}
              onDuplicate={() => duplicateBuild(b.id)}
              onRename={(name) => renameBuild(b.id, name)}
              onRemove={() => removeBuild(b.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────── карточка ───────────────── */

interface BuildCardProps {
  build: SavedBuild;
  index: BuildItemIndex;
  presets: PresetRef[];
  nameOf: (itemId: string) => string;
  onEdit: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}

function BuildCard({
  build,
  index,
  presets,
  nameOf,
  onEdit,
  onDuplicate,
  onRename,
  onRemove,
}: BuildCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(build.name);
  const [confirming, setConfirming] = useState(false);

  const result = calcBuild(build.tree, index);
  const delta = calcDelta(build.tree, index);
  const baseName = nameOf(build.baseItemId);

  const commitRename = () => {
    const next = draftName.trim();
    if (next) onRename(next);
    else setDraftName(build.name);
    setRenaming(false);
  };

  return (
    <article className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-3 transition-colors hover:border-(--primary)">
      <BuildMedia
        baseItemId={build.baseItemId}
        baseName={baseName}
        result={result}
        presets={presets}
        nameOf={nameOf}
        compact
      />

      {renaming ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            className="h-11 w-full rounded-xs border border-(--primary) bg-(--color-darkbase) px-3 font-blender-book text-sm text-text-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={commitRename}
            aria-label="Сохранить название"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-(--primary) text-(--primary)"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setRenaming(false)}
            aria-label="Отменить"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-secondary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <h2 className="truncate font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            {build.name}
          </h2>
          <p className="truncate font-blender-book text-sm text-text-secondary">
            {baseName}
            {build.purpose ? ` · ${build.purpose}` : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Эрго" value={result.stats.ergonomics} delta={delta.ergonomics} higherIsBetter />
        <Stat
          label="Отдача"
          value={result.stats.recoilSum}
          delta={delta.recoilSum}
          higherIsBetter={false}
        />
        <Stat
          label="Вес"
          value={result.stats.weight}
          delta={delta.weight}
          higherIsBetter={false}
        />
        <Stat label="Модулей" value={result.stats.modCount} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xs border border-(--primary) px-3 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
        >
          <Wrench className="h-4 w-4" aria-hidden="true" />
          В конструктор
        </button>

        <button
          type="button"
          onClick={() => setRenaming(true)}
          aria-label="Переименовать"
          className="flex h-11 w-11 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Дублировать"
          className="flex h-11 w-11 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
        </button>

        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRemove}
              className="flex h-11 items-center rounded-xs border border-danger px-3 font-blender-medium text-xs uppercase tracking-widest text-danger"
            >
              Удалить
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              aria-label="Отменить удаление"
              className="flex h-11 w-11 items-center justify-center rounded-xs border border-lines-hover text-text-secondary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Удалить сборку"
            className="flex h-11 w-11 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-danger hover:text-danger"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

interface StatProps {
  label: string;
  value: number;
  delta?: number;
  /** Эргономика — больше лучше; отдача и вес — меньше. Цвет по СМЫСЛУ, не по знаку. */
  higherIsBetter?: boolean;
}

function Stat({ label, value, delta, higherIsBetter }: StatProps) {
  const changed = delta != null && delta !== 0;
  const good = changed && (higherIsBetter ? delta > 0 : delta < 0);

  return (
    <div className="flex flex-col rounded-xs border border-lines-hover bg-(--color-darkbase) px-2 py-1.5">
      <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
        {label}
      </span>
      <span className="font-blender-medium text-xs text-text-primary">
        {value}
        {changed && (
          <span className={good ? 'ml-1 text-success' : 'ml-1 text-danger'}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </span>
    </div>
  );
}

/* ───────────────── скелетоны ───────────────── */

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-3"
        >
          <BuildMediaSkeleton compact />
          <div className="h-5 w-2/3 animate-pulse rounded-xs bg-card-menu" aria-hidden="true" />
          <div className="h-13 w-full animate-pulse rounded-xs bg-card-menu" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
