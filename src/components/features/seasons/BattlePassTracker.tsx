'use client';

// Оркестратор трекера БП. Владеет набором полученных наград и счётчиками документов (localStorage
// через стор), считает сводку и прогресс страниц. Раскладка (редизайн V4DYA 2026-08-14): ДВЕ КОЛОНКИ —
// награды слева + рейл документации справа (на <lg складываются в одну колонку). Гидратация из
// localStorage под mounted-гейтом со скелетоном (§4.8), чтобы SSR и первый клиентский рендер совпали.
import { useEffect, useMemo, useState } from 'react';
import type { Season } from '@/data/eft-seasons';
import { BP_DOC_ORDER, BP_LIMIT_BY_MODE, BP_PAGES, type BpDocType, type BpReward } from '@/data/eft-battlepass';
import { computePageProgress, computeSummary } from '@/lib/battlepass';
import { useBattlePassStore } from '@/store/useBattlePassStore';
import { BattlePassRewards } from './BattlePassRewards';
import { BattlePassDocuments } from './BattlePassDocuments';

const EMPTY: string[] = [];
const EMPTY_DOCS: Partial<Record<BpDocType, number>> = {};

export function BattlePassTracker({ season }: { season: Season }) {
  const slug = season.slug;
  const claimedMap = useBattlePassStore((s) => s.claimed);
  const docCountsMap = useBattlePassStore((s) => s.docCounts);
  const toggle = useBattlePassStore((s) => s.toggle);
  const incDoc = useBattlePassStore((s) => s.incDoc);
  const bumpDaily = useBattlePassStore((s) => s.bumpDaily);
  const rolloverDaily = useBattlePassStore((s) => s.rolloverDaily);
  const dailyRaw = useBattlePassStore((s) => s.daily[slug]);
  const resetSeason = useBattlePassStore((s) => s.resetSeason);

  const claimedArr = claimedMap[slug] ?? EMPTY;
  const docCountsRaw = docCountsMap[slug] ?? EMPTY_DOCS;

  const [mounted, setMounted] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => setMounted(true), []);

  const claimedSet = useMemo<Set<string>>(() => new Set<string>(mounted ? claimedArr : []), [mounted, claimedArr]);
  const collected = mounted ? docCountsRaw : EMPTY_DOCS;

  // Дневной лимит исчерпан + игрок подтвердил «Да» (идёт таймер отката) → замок на доступные награды.
  // Пока таймер тикает, получение наград заблокировано; снять — 7-сек удержанием карточки → модалка
  // «Уже прошёл день?» → rolloverDaily (правка V4DYA 2026-08-15). Ролловер по истечении 24ч делает
  // DailyModeBlock — он всегда смонтирован, поэтому замок снимается сам, когда окно закрывается.
  const dCap = dailyRaw?.mode ? BP_LIMIT_BY_MODE[dailyRaw.mode] : null;
  const dailyLocked =
    mounted &&
    dCap != null &&
    (dailyRaw?.count ?? 0) >= dCap &&
    (dailyRaw?.continued ?? false) &&
    dailyRaw?.ackCap === dCap;
  const summary = useMemo(() => computeSummary(claimedSet), [claimedSet]);
  const progressByPage = useMemo(() => {
    const list = computePageProgress(claimedSet);
    return new Map(list.map((p) => [p.page, p]));
  }, [claimedSet]);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-7">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="h-12 animate-pulse rounded-sm bg-(--color-darkbase)" />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-sm bg-(--color-darkbase)" />
            ))}
          </div>
        </div>
        <div className="h-96 w-full shrink-0 animate-pulse rounded-sm bg-(--color-darkbase) lg:w-87" />
      </div>
    );
  }

  const onReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    resetSeason(slug);
    setConfirmReset(false);
  };

  // Получение награды потребляет её документы «из рук» (или, если их нет, растит потраченное);
  // снятие — возвращает. Отсюда рост «найдено в рейде» и заполнение строк-типов (grill V4DYA 2026-08-14).
  const onToggleReward = (reward: BpReward) => {
    const isClaimed = claimedSet.has(reward.id);
    // Клик «Отметить получение» тоже засчитывается в дневной лимит (правка V4DYA 2026-08-15):
    // считаем ТОЛЬКО документы, которых ещё не было в руках (max(0, need−have)) — набранные ранее
    // через ячейку/рейл уже посчитаны, иначе задвоение. На снятии дневной счётчик не уменьшаем (Q1).
    if (!isClaimed) {
      let newlyFound = 0;
      for (const t of BP_DOC_ORDER) {
        const need = reward.cost[t] ?? 0;
        if (need) newlyFound += Math.max(0, need - (collected[t] ?? 0));
      }
      if (newlyFound > 0) bumpDaily(slug, newlyFound);
    }
    toggle(slug, reward.id);
    for (const t of BP_DOC_ORDER) {
      const n = reward.cost[t] ?? 0;
      if (n) incDoc(slug, t, isClaimed ? n : -n);
    }
  };

  // Явный набор документа игроком (клик по ячейке карточки ИЛИ рейл) — растит счётчик документа
  // И, при выбранном режиме, дневной счётчик лимита (только +1; «−»/ПКМ его не трогают, Q1).
  // Получение награды (onToggleReward) идёт мимо — там свой incDoc, в дневной лимит не попадает.
  const onDocCollect = (t: BpDocType, d: number) => {
    incDoc(slug, t, d);
    if (d > 0) bumpDaily(slug, d);
  };

  // Hold-to-unlock: «догнать» до страницы — отметить все неполученные награды предыдущих страниц
  // (снимает гейт прогрессии + пересчитывает документы слева и справа). Grill V4DYA.
  const onCatchUp = (uptoPage: number) => {
    for (const p of BP_PAGES) {
      if (p.page >= uptoPage) break;
      for (const r of p.rewards) {
        if (!claimedSet.has(r.id)) onToggleReward(r);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-7">
      <div className="min-w-0 flex-1">
        <BattlePassRewards
          claimed={claimedSet}
          collected={collected}
          progressByPage={progressByPage}
          onToggleReward={onToggleReward}
          onIncDoc={onDocCollect}
          onCatchUp={onCatchUp}
          dailyLocked={dailyLocked}
          onDailyReset={() => rolloverDaily(slug)}
        />
      </div>
      <aside className="w-full shrink-0 lg:w-87">
        <BattlePassDocuments
          slug={slug}
          summary={summary}
          collected={collected}
          onInc={onDocCollect}
          onReset={onReset}
          confirmReset={confirmReset}
        />
      </aside>
    </div>
  );
}
