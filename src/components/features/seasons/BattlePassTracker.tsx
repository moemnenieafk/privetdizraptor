'use client';

// Оркестратор трекера БП: владеет набором полученных наград (localStorage через стор), считает
// сводку и прогресс страниц, разводит по вкладкам «Награды» / «Документы». Гидратация из
// localStorage — под mounted-гейтом со скелетоном (§4.8), чтобы SSR и первый клиентский рендер
// совпадали (оба пустые), а реальные данные применялись после mount.
import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Season } from '@/data/eft-seasons';
import type { BpDocType } from '@/data/eft-battlepass';
import { computePageProgress, computeSummary } from '@/lib/battlepass';
import { useBattlePassStore } from '@/store/useBattlePassStore';
import { BattlePassRewards } from './BattlePassRewards';
import { BattlePassDocuments } from './BattlePassDocuments';

const EMPTY: string[] = [];
const EMPTY_DOCS: Partial<Record<BpDocType, number>> = {};
const MICRO = 'font-blender-medium text-type-micro uppercase tracking-widest text-text-muted';

type Tab = 'rewards' | 'docs';

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex h-10 items-center rounded-xs border px-4 font-blender-medium text-xs uppercase tracking-widest transition-colors',
        active
          ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)'
          : 'border-lines-hover text-text-secondary hover:border-(--primary)/60 hover:text-text-primary',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function BattlePassTracker({ season }: { season: Season }) {
  const slug = season.slug;
  const claimedMap = useBattlePassStore((s) => s.claimed);
  const docCountsMap = useBattlePassStore((s) => s.docCounts);
  const toggle = useBattlePassStore((s) => s.toggle);
  const setMany = useBattlePassStore((s) => s.setMany);
  const incDoc = useBattlePassStore((s) => s.incDoc);
  const resetSeason = useBattlePassStore((s) => s.resetSeason);

  const claimedArr = claimedMap[slug] ?? EMPTY;
  const docCountsRaw = docCountsMap[slug] ?? EMPTY_DOCS;

  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('rewards');
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => setMounted(true), []);

  const claimedSet = useMemo<Set<string>>(
    () => new Set<string>(mounted ? claimedArr : []),
    [mounted, claimedArr],
  );
  const collected = mounted ? docCountsRaw : EMPTY_DOCS;
  const summary = useMemo(() => computeSummary(claimedSet), [claimedSet]);
  const progressByPage = useMemo(() => {
    const list = computePageProgress(claimedSet);
    return new Map(list.map((p) => [p.page, p]));
  }, [claimedSet]);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-14 animate-pulse rounded-sm bg-(--color-darkbase)" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-sm bg-(--color-darkbase)" />
          ))}
        </div>
      </div>
    );
  }

  const pct = Math.round((summary.rewardsClaimed / summary.rewardsTotal) * 100);

  const onReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    resetSeason(slug);
    setConfirmReset(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Липкая полоса общего прогресса ──────────────────────────── */}
      <div className="sticky top-18 z-30 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-sm border border-lines-hover bg-[color-mix(in_srgb,var(--color-base)_88%,transparent)] p-3 backdrop-blur-md">
        <div className="flex min-w-56 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="flex items-baseline gap-1.5">
              <span className={MICRO}>Награды</span>
              <span className="font-blender-medium text-base text-(--primary)">
                {summary.rewardsClaimed} / {summary.rewardsTotal}
              </span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className={MICRO}>Осталось документов</span>
              <span className="font-blender-medium text-base text-text-primary">
                {summary.remainingTotal}
              </span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className={MICRO}>Собрано</span>
              <span className="font-blender-medium text-base text-nvg-green">
                {summary.spentTotal} / {summary.neededTotal}
              </span>
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-(--color-darkbase)">
            <div
              className="h-full rounded-full bg-(--primary) transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className={[
            'flex h-9 items-center gap-1.5 rounded-xs border px-2.5 font-blender-medium text-type-micro uppercase tracking-widest transition-colors',
            confirmReset
              ? 'border-danger text-danger'
              : 'border-lines-hover text-text-secondary hover:border-danger hover:text-danger',
          ].join(' ')}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {confirmReset ? 'Точно? Сбросить' : 'Сброс'}
        </button>
      </div>

      {/* ── Вкладки ─────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <TabButton active={tab === 'rewards'} onClick={() => setTab('rewards')}>
          Награды
        </TabButton>
        <TabButton active={tab === 'docs'} onClick={() => setTab('docs')}>
          Документы
        </TabButton>
      </div>

      {tab === 'rewards' ? (
        <BattlePassRewards
          claimed={claimedSet}
          collected={collected}
          progressByPage={progressByPage}
          onToggle={(id) => toggle(slug, id)}
          onSetPage={(ids, on) => setMany(slug, ids, on)}
        />
      ) : (
        <BattlePassDocuments summary={summary} collected={collected} onInc={(t, d) => incDoc(slug, t, d)} />
      )}
    </div>
  );
}
