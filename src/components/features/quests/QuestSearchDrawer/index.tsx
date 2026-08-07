'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TaskRaw, QuestBarterLite } from '@/types/quest';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { useQuestStore } from '@/store/useQuestStore';
import { buildQuestSearchText, parseSearchTerms, matchesTerms } from '@/lib/quest-search';

const TRADER_ORDER = [
  'prapor', 'therapist', 'skier', 'peacekeeper', 'mechanic',
  'jaeger', 'ragman', 'ref', 'fence', 'lightkeeper', 'btrdriver',
];

const MAX_RESULTS = 80;

type Chip = 'all' | 'kappa' | 'lk';

interface Props {
  open: boolean;
  onClose: () => void;
  tasks: TaskRaw[];
  bartersByQuest?: Record<string, QuestBarterLite[]>;
  /** Клик по результату: сменить торговца + перелёт + открыть правый дровер (склейка в QuestMapClient). */
  onSelectResult: (task: TaskRaw) => void;
}

/**
 * Левый дровер «Поиск по заданию» — ВИЗУАЛ 1:1 с контролом «Задания» карт (MapSearchDrawer): чипы
 * FilterChip (Все / Смотритель% / Каппа%, без СЮЖЕТ), лента портретов, строки QuestRow с трейдер-
 * тинтом. ЛОГИКА questmap: глобальный поиск по 4 полям (название + цели + награды + открываемые
 * бартеры, см. lib/quest-search), мульти-поиск ИЛИ, клик → канвас к квесту (onSelectResult).
 */
export function QuestSearchDrawer({ open, onClose, tasks, bartersByQuest, onSelectResult }: Props) {
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  const [traderFilter, setTraderFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Проценты чипов = реальный прогресс (как в MapSearchDrawer/PlayerTelemetry).
  const completed = useQuestStore((s) => s.completedQuests);
  const doneSet = useMemo(() => new Set(completed), [completed]);
  const pctDone = (pred: (t: TaskRaw) => boolean): number => {
    const list = tasks.filter(pred);
    return list.length ? Math.round((list.filter((t) => doneSet.has(t.id)).length / list.length) * 100) : 0;
  };
  const kappaPct = pctDone((t) => t.kappaRequired);
  const lkPct = pctDone((t) => t.lightkeeperRequired);

  // Индекс поиска: questId → строка (название + цели + награды + открываемые бартеры).
  const index = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) m.set(t.id, buildQuestSearchText(t, bartersByQuest?.[t.id]));
    return m;
  }, [tasks, bartersByQuest]);

  const traders = useMemo(() => {
    const seen = new Map<string, TaskRaw['trader']>();
    for (const t of tasks) if (!seen.has(t.trader.normalizedName)) seen.set(t.trader.normalizedName, t.trader);
    return TRADER_ORDER.filter((n) => seen.has(n)).map((n) => seen.get(n)!);
  }, [tasks]);

  const { results, total } = useMemo(() => {
    const terms = parseSearchTerms(query);
    const all = tasks.filter((t) => {
      if (chip === 'kappa' && !t.kappaRequired) return false;
      if (chip === 'lk' && !t.lightkeeperRequired) return false;
      if (traderFilter && t.trader.normalizedName !== traderFilter) return false;
      if (terms.length > 0 && !matchesTerms(index.get(t.id) ?? '', terms)) return false;
      return true;
    });
    all.sort((a, b) => (a.minPlayerLevel - b.minPlayerLevel) || a.name.localeCompare(b.name));
    return { results: all.slice(0, MAX_RESULTS), total: all.length };
  }, [tasks, query, chip, traderFilter, index]);

  const hlQuery = parseSearchTerms(query)[0] ?? '';

  return (
    <div
      className={`absolute inset-y-0 left-0 z-[540] flex w-87 flex-col border-r border-lines-hover bg-(--color-base)/95 backdrop-blur-md transition-transform duration-200 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Заголовок */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-3.5">
        <button onClick={onClose} aria-label="Закрыть поиск" className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-(--primary) bg-(--primary) text-(--color-base)">
          <span className="icon-mask icon-eft-search-icon h-5.5 w-5.5" />
        </button>
        <span className="font-blender-medium text-base uppercase tracking-widest text-text-primary">Поиск по заданию</span>
      </div>

      <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-3">
        {/* Инпут + подсказка мульти-поиска */}
        <div className="flex flex-col gap-2">
          <div className="flex h-9 items-center gap-3.5 rounded-xs border border-lines-hover bg-(--color-base) px-3.5">
            <span className="icon-mask icon-eft-quests h-4 w-4 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="НАЗВАНИЕ ЗАДАНИЯ ИЛИ ПРЕДМЕТ"
              className="w-full bg-transparent font-blender-medium text-type-caption uppercase tracking-wide text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          <p className="font-blender-medium text-[10px] text-text-secondary">
            Мульти-поиск: 5.56, LEDX, Bitcoin. Ищет по названию, целям и наградам квеста.
          </p>
        </div>

        {/* Чипы фильтров: Все / Смотритель% / Каппа% */}
        <div className="flex gap-2">
          <FilterChip active={chip === 'all'} color="var(--color-text-secondary)" onClick={() => setChip('all')} maskIcon="icon-eft-quests" label="Все" />
          <FilterChip active={chip === 'lk'} color="var(--color-lightkeeper)" onClick={() => setChip((c) => (c === 'lk' ? 'all' : 'lk'))} maskIcon="icon-eft-profile-lightkeeper" label={`${lkPct}%`} />
          <FilterChip active={chip === 'kappa'} color="var(--color-kappa)" onClick={() => setChip((c) => (c === 'kappa' ? 'all' : 'kappa'))} maskIcon="icon-eft-profile-kappa" label={`${kappaPct}%`} />
        </div>

        {/* Лента портретов-фильтров */}
        {traders.length > 0 && (
          <div className="flex justify-between">
            {traders.map((t) => {
              const on = traderFilter === t.normalizedName;
              return (
                <button
                  key={t.normalizedName}
                  type="button"
                  onClick={() => setTraderFilter((cur) => (cur === t.normalizedName ? null : t.normalizedName))}
                  title={t.name}
                  className={`size-5.5 shrink-0 overflow-hidden rounded-xs border transition-colors ${on ? 'border-(--primary)' : 'border-transparent hover:border-lines-hover'}`}
                >
                  <img src={traderImg(t.normalizedName)} alt="" className="size-full object-cover" />
                </button>
              );
            })}
          </div>
        )}

        {/* Результаты — строки QuestRow (трейдер-тинт) */}
        <div className="flex flex-col gap-1">
          {results.length === 0 ? (
            <p className="px-1 py-4 text-center font-blender-book text-xs text-text-muted">Заданий не найдено</p>
          ) : (
            <>
              {results.map((task) => (
                <QuestRow key={task.id} task={task} query={hlQuery} onSelect={onSelectResult} />
              ))}
              {total > MAX_RESULTS && (
                <p className="px-1 py-2 text-center font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
                  Показаны первые {MAX_RESULTS} из {total} — уточни запрос
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, color, label, maskIcon, onClick }: { active: boolean; color: string; label: string; maskIcon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? { backgroundColor: color, color: 'var(--color-base)' } : { borderColor: color, color }}
      className={`flex h-6 flex-1 items-center justify-center gap-1.5 rounded border-[0.5px] font-blender-medium text-[10px] uppercase transition-colors ${active ? 'border-transparent' : ''}`}
    >
      <span className={`icon-mask ${maskIcon} h-4 w-4`} style={{ backgroundColor: active ? 'var(--color-base)' : color }} />
      {label}
    </button>
  );
}

function QuestRow({ task, query, onSelect }: { task: TaskRaw; query: string; onSelect: (t: TaskRaw) => void }) {
  const tint = `var(${traderCssVar(task.trader.normalizedName)}, var(--color-lines-hover))`;
  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      title={task.name}
      className="flex h-9 w-full items-center justify-between rounded border-[0.5px] px-3.5 text-left transition-shadow hover:ring-1 hover:ring-(--primary)"
      style={{
        borderColor: tint,
        background: `radial-gradient(140% 160% at 0% 50%, color-mix(in srgb, ${tint} 38%, transparent), transparent 55%)`,
      }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <img src={traderImg(task.trader.normalizedName)} alt="" className="size-4 shrink-0 rounded-xs border border-black/50 object-cover" />
        <span className="min-w-0 truncate font-blender-medium text-xs text-text-primary">
          {query ? <HighlightedText text={task.name} query={query} /> : task.name}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-blender-medium text-[10px] uppercase text-text-secondary">ур. {task.minPlayerLevel}+</span>
        {task.lightkeeperRequired && (
          <span className="flex size-4 items-center justify-center rounded-xs" style={{ backgroundColor: 'color-mix(in srgb, var(--color-lightkeeper) 12%, transparent)' }}>
            <span className="icon-mask icon-eft-profile-lightkeeper h-3 w-3" />
          </span>
        )}
        {task.kappaRequired && <span className="icon-mask icon-eft-profile-kappa h-4 w-4" />}
      </span>
    </button>
  );
}
