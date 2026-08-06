'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TaskRaw, QuestBarterLite } from '@/types/quest';
import { traderImg } from '@/lib/trader-utils';
import { HighlightedText } from '@/components/ui/HighlightedText';
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
 * Левый дровер «Поиск по заданию» (паттерн MapSearchDrawer, 348px). Глобальный поиск по 4 полям
 * (название + цели + награды + открываемые бартеры, см. lib/quest-search) с мульти-поиском (ИЛИ),
 * чипами-фильтрами и рядом портретов-торговцев. Клик по результату уводит канвас к квесту.
 */
export function QuestSearchDrawer({ open, onClose, tasks, bartersByQuest, onSelectResult }: Props) {
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  const [traderFilter, setTraderFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Индекс поиска: questId → строка (собирается один раз на набор задач/бартеров).
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

  const chipCls = (active: boolean) =>
    `flex h-7 items-center gap-1.5 rounded border px-2.5 font-blender-medium text-type-caption uppercase tracking-widest transition-colors ${
      active ? 'border-(--primary)/40 bg-(--primary)/15 text-(--primary)' : 'border-lines-hover text-text-secondary hover:text-text-primary'
    }`;

  return (
    <div
      className={`absolute inset-y-0 left-0 z-[540] flex w-87 flex-col border-r border-lines-hover bg-(--color-base)/95 backdrop-blur-md transition-transform duration-200 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Заголовок */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-lines-hover px-3.5">
        <button onClick={onClose} title="Закрыть" className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--primary)/20 text-(--primary)">
          <span className="icon-mask icon-eft-search-icon h-4 w-4" />
        </button>
        <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">Поиск по заданию</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto scrollbar-compact p-3.5">

        {/* Инпут */}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Введите название задания или предмет…"
          className="h-9 w-full rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 font-blender-book text-xs text-text-primary outline-none placeholder:text-text-secondary focus:border-(--primary)"
        />
        <p className="font-blender-book text-type-caption text-text-muted">
          Мульти-поиск: LEDX, Bitcoin, Ключ-карта. Ищет по названию, целям и наградам квеста.
        </p>

        {/* Чипы-фильтры */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => setChip('all')} className={chipCls(chip === 'all')}>Все</button>
          <button onClick={() => setChip('kappa')} className={chipCls(chip === 'kappa')}>
            <span className="icon-mask icon-eft-profile-kappa h-4 w-4" /> Каппа
          </button>
          <button onClick={() => setChip('lk')} className={chipCls(chip === 'lk')}>
            <span className="icon-mask icon-eft-profile-lightkeeper h-4 w-4" /> Смотритель
          </button>
        </div>

        {/* Ряд портретов-фильтров */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {traders.map((tr) => {
            const active = traderFilter === tr.normalizedName;
            return (
              <button
                key={tr.normalizedName}
                onClick={() => setTraderFilter(active ? null : tr.normalizedName)}
                title={tr.name}
                className={`h-7 w-7 shrink-0 overflow-hidden rounded transition-all ${active ? 'ring-1 ring-(--primary)' : ''}`}
                style={{ opacity: traderFilter && !active ? 0.45 : 1 }}
              >
                <img src={traderImg(tr.normalizedName)} alt={tr.name} width={28} height={28} className="block object-cover object-top" />
              </button>
            );
          })}
        </div>

        {/* Результаты */}
        <div className="flex min-h-0 flex-1 flex-col">
          {results.length === 0 ? (
            <div className="flex h-9 items-center font-blender-book text-xs text-text-secondary">Ничего не найдено</div>
          ) : (
            <>
              {results.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onSelectResult(task)}
                  className="flex h-11 shrink-0 items-center gap-2.5 border-b border-lines-hover px-1 text-left transition-colors hover:bg-card-menu"
                >
                  <img src={traderImg(task.trader.normalizedName)} alt={task.trader.name} width={24} height={24} className="shrink-0 rounded-xs opacity-80" />
                  <span className="min-w-0 flex-1 truncate font-blender-book text-xs leading-tight text-text-primary">
                    <HighlightedText text={task.name} query={parseSearchTerms(query)[0] ?? ''} />
                  </span>
                  {task.kappaRequired && <span className="icon-mask icon-eft-profile-kappa h-4 w-4 shrink-0 text-(--color-kappa)" />}
                  {task.lightkeeperRequired && <span className="icon-mask icon-eft-profile-lightkeeper h-4 w-4 shrink-0 text-(--color-lightkeeper)" />}
                  <span className="shrink-0 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">УР. {task.minPlayerLevel}+</span>
                </button>
              ))}
              {total > MAX_RESULTS && (
                <div className="flex h-9 items-center font-blender-book text-type-caption text-text-muted">
                  Показаны первые {MAX_RESULTS} из {total} — уточни запрос
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
