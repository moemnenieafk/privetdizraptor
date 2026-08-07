'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useQuestMapUiStore } from '@/store/useQuestMapUiStore';
import { useQuestStore } from '@/store/useQuestStore';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import type { TaskRaw } from '@/types/quest';

const TRADER_ORDER = [
  'prapor', 'therapist', 'skier', 'peacekeeper', 'mechanic',
  'jaeger', 'ragman', 'ref', 'fence', 'lightkeeper', 'btrdriver',
];

const MAX_RESULTS = 60;

type Chip = 'all' | 'kappa' | 'lk';

interface Props {
  tasks: TaskRaw[];
  /** Перелёт к ноде квеста на карте. */
  onFocus: (task: TaskRaw) => void;
}

/**
 * Шит поиска квеста (mobile). По макету Q5: чипы ВСЕ / Смотритель% / Каппа%, лента
 * портретов-фильтров, инпут, строки результатов с трейдер-тинтом (ур.N+ / бейджи каппы-лк).
 * Поиск по названию, фильтр — по каппа/лк + торговцу. Тап по строке — перелёт к ноде, шит закрыт.
 */
export function QuestSearchSheet({ tasks, onFocus }: Props) {
  const open = useQuestMapUiStore((s) => s.activeSheet === 'search');
  const close = useQuestMapUiStore((s) => s.closeSheet);
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  const [traderFilter, setTraderFilter] = useState<string | null>(null);

  // Проценты чипов = реальный прогресс (как в десктопном QuestSearchDrawer).
  const completed = useQuestStore((s) => s.completedQuests);
  const doneSet = useMemo(() => new Set(completed), [completed]);
  const pctDone = (pred: (t: TaskRaw) => boolean): number => {
    const list = tasks.filter(pred);
    return list.length ? Math.round((list.filter((t) => doneSet.has(t.id)).length / list.length) * 100) : 0;
  };
  const kappaPct = pctDone((t) => t.kappaRequired);
  const lkPct = pctDone((t) => t.lightkeeperRequired);

  const traders = useMemo(() => {
    const seen = new Map<string, TaskRaw['trader']>();
    for (const t of tasks) if (!seen.has(t.trader.normalizedName)) seen.set(t.trader.normalizedName, t.trader);
    return TRADER_ORDER.filter((n) => seen.has(n)).map((n) => seen.get(n)!);
  }, [tasks]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const all = tasks.filter((t) => {
      if (chip === 'kappa' && !t.kappaRequired) return false;
      if (chip === 'lk' && !t.lightkeeperRequired) return false;
      if (traderFilter && t.trader.normalizedName !== traderFilter) return false;
      if (query && !t.name.toLowerCase().includes(query)) return false;
      return true;
    });
    all.sort((a, b) => (a.minPlayerLevel - b.minPlayerLevel) || a.name.localeCompare(b.name));
    return all.slice(0, MAX_RESULTS);
  }, [q, chip, traderFilter, tasks]);

  // Пустой запрос без фильтров → не заваливаем список всеми 500 квестами (как раньше).
  const showList = q.trim() !== '' || chip !== 'all' || traderFilter !== null;

  return (
    <BottomSheet open={open} title="Поиск по заданию" onClose={close}>
      {/* Чипы: ВСЕ / Смотритель% / Каппа% */}
      <div className="mb-3 flex gap-2">
        <FilterChip active={chip === 'all'} color="var(--color-text-secondary)" onClick={() => setChip('all')} maskIcon="icon-eft-quests" label="Все" />
        <FilterChip active={chip === 'lk'} color="var(--color-lightkeeper)" onClick={() => setChip((c) => (c === 'lk' ? 'all' : 'lk'))} maskIcon="icon-eft-profile-lightkeeper" label={`${lkPct}%`} />
        <FilterChip active={chip === 'kappa'} color="var(--color-kappa)" onClick={() => setChip((c) => (c === 'kappa' ? 'all' : 'kappa'))} maskIcon="icon-eft-profile-kappa" label={`${kappaPct}%`} />
      </div>

      {/* Лента портретов-фильтров */}
      {traders.length > 0 && (
        <div className="mb-3 flex justify-between">
          {traders.map((t) => {
            const on = traderFilter === t.normalizedName;
            return (
              <button
                key={t.normalizedName}
                type="button"
                onClick={() => setTraderFilter((cur) => (cur === t.normalizedName ? null : t.normalizedName))}
                title={t.name}
                className={`size-6 shrink-0 overflow-hidden rounded-xs border transition-colors ${on ? 'border-(--primary)' : 'border-transparent hover:border-lines-hover'}`}
              >
                <img src={traderImg(t.normalizedName)} alt="" className="size-full object-cover object-top" />
              </button>
            );
          })}
        </div>
      )}

      {/* Инпут + подсказка мульти-поиска */}
      <div className="mb-2 flex h-9 items-center gap-3.5 rounded-xs border border-lines-hover bg-(--color-base) px-3.5">
        <span className="icon-mask icon-eft-quests h-4 w-4 shrink-0 text-text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ВВЕДИТЕ НАЗВАНИЕ ЗАДАНИЯ"
          className="w-full bg-transparent font-blender-medium text-type-caption uppercase tracking-wide text-text-primary outline-none placeholder:text-text-muted"
        />
      </div>
      <p className="mb-3 font-blender-medium text-[10px] text-text-secondary">
        Поддерживается мульти-поиск, например: LEDX, Bitcoin, Ключ-карта
      </p>

      {/* Результаты — строки с трейдер-тинтом */}
      <ul className="flex flex-col gap-1 pb-2">
        {showList && results.map((t) => {
          const tint = `var(${traderCssVar(t.trader.normalizedName)}, var(--color-lines-hover))`;
          return (
            <li key={t.id}>
              <button
                onClick={() => {
                  onFocus(t);
                  close();
                }}
                title={t.name}
                className="flex h-9 w-full items-center justify-between rounded border-[0.5px] px-3.5 text-left"
                style={{
                  borderColor: tint,
                  background: `radial-gradient(140% 160% at 0% 50%, color-mix(in srgb, ${tint} 38%, transparent), transparent 55%)`,
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <img
                    src={traderImg(t.trader.normalizedName)}
                    alt=""
                    className="size-4 shrink-0 rounded-xs border border-black/50 object-cover object-top"
                  />
                  <span className="min-w-0 truncate font-blender-medium text-xs text-text-primary">{t.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-blender-medium text-[10px] uppercase text-text-secondary">ур. {t.minPlayerLevel}+</span>
                  {t.lightkeeperRequired && (
                    <span className="flex size-4 items-center justify-center rounded-xs" style={{ backgroundColor: 'color-mix(in srgb, var(--color-lightkeeper) 12%, transparent)' }}>
                      <span className="icon-mask icon-eft-profile-lightkeeper h-3 w-3" />
                    </span>
                  )}
                  {t.kappaRequired && <span className="icon-mask icon-eft-profile-kappa h-4 w-4" />}
                  <ChevronRight className="size-4 text-text-muted" strokeWidth={2} />
                </span>
              </button>
            </li>
          );
        })}
        {showList && results.length === 0 && (
          <li className="py-6 text-center font-blender-book text-sm text-text-muted">Заданий не найдено</li>
        )}
        {!showList && (
          <li className="py-6 text-center font-blender-book text-sm text-text-muted">
            Введите название или выберите фильтр
          </li>
        )}
      </ul>
    </BottomSheet>
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
