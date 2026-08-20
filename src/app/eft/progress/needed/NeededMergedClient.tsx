'use client';

// Объединённый трекер «Важные предметы» (слияние /tracker + /needed).
// Единый список ПО ПРЕДМЕТУ: агрегирует квесты + убежище. Ячейка 112px (TrackCell, без
// вертикальной заливки — прогресс показывает фон строки) — единственный счётчик; ЛКМ+1/ПКМ−1
// авто-распределяет по источникам (FiR-квесты → не-FiR квесты → убежище) в родные сторы.
// Разворот — точечный редакт источников + «в стэше/докупить». Раскладка: две masonry-колонки.
// Решения: docs/decisions/important-items-merge.md.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Search } from 'lucide-react';
import { TrackCell } from '@/components/ui/kit';
import { QtyControl } from '@/components/ui/QtyControl';
import { type HideoutStationInfo } from '@/components/features/hideout/HideoutLevelsPanel';
import { HideoutModulesPanel, moduleIcon } from '@/components/features/hideout/HideoutModulesPanel';
import { TRADER_COLORS } from '@/data/traderColors';
import { traderImg } from '@/lib/trader-utils';
import { useQuestStore } from '@/store/useQuestStore';
import { useHideoutStore, hideoutItemKey } from '@/store/useHideoutStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { computeStashOverlay } from '@/lib/stash-overlay';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { itemIconUrl } from '@/lib/item-icon';
import type { NeededData, NeededItem } from '@/lib/needed-items';

const MAP_SLUG: Record<string, string> = {
  Таможня: 'customs', 'Улицы Таркова': 'streets-of-tarkov', Развязка: 'interchange', Резерв: 'reserve',
  Маяк: 'lighthouse', Ледокол: 'icebreaker', Завод: 'factory', Лабиринт: 'labyrinth', Берег: 'shoreline',
  Лес: 'woods', Эпицентр: 'ground-zero', Лаборатория: 'the-lab',
};

const MICRO = 'font-blender-medium text-type-micro uppercase tracking-widest';

/** FiR-маркер (найдено в рейде) — компактный чек. */
function FirMark({ className = '' }: { className?: string }) {
  return (
    <span
      title="Найдено в рейде"
      className={`flex h-4 items-center gap-0.5 rounded-br-xs bg-(--color-darkbase)/90 px-1 ${className}`}
    >
      <Check className="h-2.5 w-2.5 text-nvg-green" strokeWidth={3} aria-hidden />
    </span>
  );
}

/**
 * Мета-бейдж строки предмета — дизайн 1:1 со StatusBadge карточки предмета
 * (ItemDetailLayout: БАРТЕР/КРАФТ/ЗАДАНИЕ) для единой идентификации. Иконка — маска по пути.
 */
const META_BADGE: Record<'quest' | 'hideout' | 'fir', { box: string; icon: string }> = {
  quest: { box: 'border-tactical-amber/40 bg-tactical-amber/10 text-tactical-amber', icon: 'bg-tactical-amber' },
  hideout: { box: 'border-hideout/40 bg-hideout/10 text-hideout', icon: 'bg-hideout' },
  fir: { box: 'border-nvg-green/40 bg-nvg-green/10 text-nvg-green', icon: 'bg-nvg-green' },
};
function MetaBadge({ variant, icon, children }: { variant: keyof typeof META_BADGE; icon: string; children: React.ReactNode }) {
  const s = META_BADGE[variant];
  return (
    <span className={`inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 font-blender-medium text-[0.625rem] uppercase tracking-widest ${s.box}`}>
      <span
        aria-hidden
        className={`h-3 w-3 shrink-0 ${s.icon} mask-contain mask-center mask-no-repeat`}
        style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
      />
      {children}
    </span>
  );
}

/** Анимированное число: плавный tween при инкременте/декременте (ease-out cubic ~350ms). */
function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;
    let raf = 0;
    const start = performance.now();
    const dur = 350;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(from + (to - from) * eased);
      displayRef.current = cur;
      setDisplay(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`tabular-nums ${className}`}>{display.toLocaleString('ru-RU')}</span>;
}

const STAT_ACCENT: Record<string, { icon: string; num: string }> = {
  default: { icon: 'bg-text-secondary', num: 'text-text-primary' },
  success: { icon: 'bg-success', num: 'text-success' },
  primary: { icon: 'bg-(--primary)', num: 'text-(--primary)' },
  amber: { icon: 'bg-tactical-amber', num: 'text-tactical-amber' },
};

/** Блок сводки: слева иконка (маска, перекраска в акцент) + название, справа число 28px (анимация). */
function SummaryStat({ icon, label, value, accent }: { icon: string; label: string; value: number; accent: keyof typeof STAT_ACCENT }) {
  const a = STAT_ACCENT[accent];
  return (
    <div className="flex items-center gap-3 rounded-md border border-lines-hover bg-card-menu/40 p-3">
      <span
        aria-hidden
        className={`h-6 w-6 shrink-0 ${a.icon} mask-contain mask-center mask-no-repeat`}
        style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
      />
      <span className={`${MICRO} flex-1 leading-tight text-text-muted`}>{label}</span>
      <AnimatedNumber value={value} className={`font-blender-medium text-[1.75rem] leading-none ${a.num}`} />
    </div>
  );
}

/** Общий прогресс-бар: 12 делений под сетку, %, бегунок-указатель с текущим значением, анимация. */
function SummaryProgress({ value, max, label, divisions = 12 }: { value: number; max: number; label: string; divisions?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const ptr = Math.min(98, Math.max(2, pct)); // держим бегунок в пределах шкалы
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className={`${MICRO} text-text-muted`}>{label}</span>
        <span className="flex items-baseline gap-1 font-blender-medium text-type-caption">
          <AnimatedNumber value={Math.round(pct)} className="text-(--primary)" />
          <span className="text-(--primary)">%</span>
          <span className="text-text-muted">· из {max.toLocaleString('ru-RU')}</span>
        </span>
      </div>
      <div className="relative h-6">
        {/* Бегунок-указатель со значением над шкалой */}
        <div className="absolute top-0 z-10 flex -translate-x-1/2 flex-col items-center transition-[left] duration-500 ease-out" style={{ left: `${ptr}%` }}>
          <span className="rounded-xs bg-(--primary) px-1.5 py-0.5 font-blender-medium text-[10px] leading-none tabular-nums text-(--color-base) shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_50%,transparent)]">
            <AnimatedNumber value={value} />
          </span>
          <span aria-hidden className="h-1.5 w-px bg-(--primary)" />
        </div>
        {/* Шкала + анимированная заливка */}
        <div className="absolute inset-x-0 bottom-0 h-2 overflow-hidden rounded-xs border border-lines-hover bg-(--color-base)">
          <div className="h-full bg-(--primary)/80 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
        {/* Деления под сетку */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2">
          {Array.from({ length: divisions - 1 }).map((_, i) => (
            <span key={i} aria-hidden className="absolute top-0 h-full w-0.5 bg-(--color-darkbase)" style={{ left: `${((i + 1) / divisions) * 100}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Эффективное состояние предмета из сторов (need/have/источники, с учётом уровней убежища и завершённых квестов). */
interface SrcState {
  kind: 'quest' | 'hideout';
  label: string;
  sub: string;
  /** normalizedName: торговец (квест) или станция (убежище) — для цвета/аватара/иконки чипа. */
  nn: string;
  count: number;
  collected: number;
  fir: boolean;
  maps?: string[];
  /** Уровень станции (убежище) — для индикатора «0N». */
  level?: number;
  /** minPlayerLevel (квест) — для бейджа «УР. N+». */
  minLevel?: number;
  /** Абсолютный сеттер (QtyControl в развороте). */
  set: (n: number) => void;
  /** Функциональный ±delta через живой стор (ячейка ЛКМ/ПКМ) — против гонок быстрых кликов. */
  bump: (delta: number) => void;
  /** Живое значение collected из стора (для выбора источника в distribute без stale-снапшота). */
  get: () => number;
}
interface ItemState {
  need: number;
  needFir: number;
  have: number;
  sources: SrcState[];
  buyTotal: number;
  stashUsed: number;
  stash: number;
}

export function NeededMergedClient({
  data,
  hideoutStations,
}: {
  data: NeededData;
  hideoutStations: HideoutStationInfo[];
}) {
  const questProgress = useQuestStore((s) => s.itemProgress);
  const completedQuests = useQuestStore((s) => s.completedQuests);
  const setItemCount = useQuestStore((s) => s.setItemCount);
  const incrementItem = useQuestStore((s) => s.incrementItem);
  const decrementItem = useQuestStore((s) => s.decrementItem);
  const hideoutProgress = useHideoutStore((s) => s.itemProgress);
  const hideoutLevels = useHideoutStore((s) => s.levels);
  const setHideoutProgress = useHideoutStore((s) => s.setItemProgress);
  const bumpHideoutProgress = useHideoutStore((s) => s.bumpItemProgress);
  const ownedItems = useInventoryStore((s) => s.ownedItems);
  const setOwned = useInventoryStore((s) => s.setCount);

  const completed = useMemo(() => new Set(completedQuests), [completedQuests]);

  const [search, setSearch] = useState('');
  const [hideDone, setHideDone] = useState(true);
  const [firOnly, setFirOnly] = useState(false);
  const [onlyHideout, setOnlyHideout] = useState(false);
  const [onlyQuests, setOnlyQuests] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  // Снап-порядок: замораживаем порядок id при загрузке, чтобы строки не прыгали под курсором
  // при +/− (серверный порядок статичен, живой пересортировки нет).
  const [snap] = useState<string[]>(() => [
    ...data.items.map((i) => i.itemId),
    ...data.groups.map((g) => `g:${g.key}`),
  ]);

  /** Пересчёт состояния предмета из текущих сторов. */
  const stateOf = (ni: NeededItem): ItemState => {
    const sources: SrcState[] = [];
    let need = 0;
    let needFir = 0;
    let have = 0;
    let questSoft = 0;
    let questFir = 0;
    let hideoutNeed = 0;

    for (const q of ni.quests) {
      if (completed.has(q.questId)) continue;
      const collected = Math.min(q.count, questProgress[q.questId]?.[q.objectiveId] ?? 0);
      need += q.count;
      have += collected;
      const rem = Math.max(0, q.count - collected);
      if (q.fir) {
        needFir += q.count;
        questFir += rem;
      } else {
        questSoft += rem;
      }
      sources.push({
        kind: 'quest',
        label: q.questName,
        sub: q.trader,
        nn: q.traderNn,
        count: q.count,
        collected,
        fir: q.fir,
        maps: q.maps,
        minLevel: q.minLevel,
        set: (n) => setItemCount(q.questId, q.objectiveId, Math.max(0, Math.min(q.count, n))),
        bump: (d) => (d > 0 ? incrementItem(q.questId, q.objectiveId, q.count) : decrementItem(q.questId, q.objectiveId)),
        get: () => Math.min(q.count, useQuestStore.getState().itemProgress[q.questId]?.[q.objectiveId] ?? 0),
      });
    }
    for (const h of ni.hideout) {
      if (h.level <= (hideoutLevels[h.station] ?? 0)) continue; // уровень уже построен
      const key = hideoutItemKey(h.station, h.level, ni.itemId);
      const collected = Math.min(h.count, hideoutProgress[key] ?? 0);
      need += h.count;
      have += collected;
      const rem = Math.max(0, h.count - collected);
      if (h.fir) needFir += h.count;
      hideoutNeed += rem;
      sources.push({
        kind: 'hideout',
        label: h.stationName,
        sub: `Ур. ${h.level}`,
        nn: h.station,
        count: h.count,
        collected,
        fir: h.fir,
        level: h.level,
        set: (n) => setHideoutProgress(key, Math.max(0, Math.min(h.count, n))),
        bump: (d) => bumpHideoutProgress(key, d, h.count),
        get: () => Math.min(h.count, useHideoutStore.getState().itemProgress[key] ?? 0),
      });
    }

    const stash = ownedItems[ni.itemId] ?? 0;
    const ov = computeStashOverlay({ stash, hideoutNeed, questSoftNeed: questSoft, questFirNeed: questFir });
    return {
      need,
      needFir,
      have,
      sources,
      buyTotal: ov.hideoutToObtain + ov.questSoftToObtain,
      stashUsed: ov.stashToHideout + ov.stashToQuest,
      stash,
    };
  };

  /** Авто-распределение ЛКМ/ПКМ по источникам (FiR-квесты → не-FiR → убежище).
   *  Выбор источника и ±1 — по ЖИВОМУ значению стора (get/bump), а не рендер-снапшоту:
   *  иначе быстрые клики читают устаревший collected и «возвращают то же число». */
  const distribute = (sources: SrcState[], delta: number) => {
    const order = [
      ...sources.filter((s) => s.kind === 'quest' && s.fir),
      ...sources.filter((s) => s.kind === 'quest' && !s.fir),
      ...sources.filter((s) => s.kind === 'hideout'),
    ];
    if (delta > 0) {
      const t = order.find((s) => s.get() < s.count);
      if (t) t.bump(1);
    } else {
      const t = [...order].reverse().find((s) => s.get() > 0);
      if (t) t.bump(-1);
    }
  };

  /** Прямой ввод общего числа (клик по X/Y): заливаем источники в приоритете FiR→не-FiR→убежище до total. */
  const setTotal = (sources: SrcState[], total: number) => {
    const order = [
      ...sources.filter((s) => s.kind === 'quest' && s.fir),
      ...sources.filter((s) => s.kind === 'quest' && !s.fir),
      ...sources.filter((s) => s.kind === 'hideout'),
    ];
    let remaining = total;
    for (const s of order) {
      const give = Math.max(0, Math.min(s.count, remaining));
      if (give !== s.collected) s.set(give);
      remaining -= give;
    }
  };

  const byId = useMemo(() => new Map(data.items.map((i) => [i.itemId, i])), [data.items]);
  const groupById = useMemo(() => new Map(data.groups.map((g) => [g.key, g])), [data.groups]);

  // Сводка.
  const summary = useMemo(() => {
    let need = 0;
    let have = 0;
    let buy = 0;
    let items = 0;
    for (const ni of data.items) {
      const st = stateOf(ni);
      if (st.need === 0) continue;
      items++;
      need += st.need;
      have += st.have;
      buy += st.buyTotal;
    }
    return { need, have, buy, items, remaining: Math.max(0, need - have) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.items, questProgress, hideoutProgress, hideoutLevels, ownedItems, completed]);

  const q = search.trim().toLowerCase();

  // Видимые узлы в снап-порядке (предметы + группы), с фильтрами.
  type Node = { id: string; item?: NeededItem; group?: (typeof data.groups)[number]; st?: ItemState };
  const visible: Node[] = [];
  for (const id of snap) {
    if (id.startsWith('g:')) {
      const g = groupById.get(id.slice(2));
      if (!g) continue;
      if (onlyHideout) continue; // any-of группы — квестовые, не убежище
      if (q && !g.questName.toLowerCase().includes(q)) continue;
      if (hideDone) {
        /* группы прогресс не трекают в v1 — показываем всегда, если не done-фильтр не режет */
      }
      visible.push({ id, group: g });
    } else {
      const ni = byId.get(id);
      if (!ni) continue;
      const st = stateOf(ni);
      if (st.need === 0) continue;
      if (firOnly && st.needFir === 0) continue;
      if (onlyHideout && !st.sources.some((s) => s.kind === 'hideout')) continue;
      if (onlyQuests && !st.sources.some((s) => s.kind === 'quest')) continue;
      if (hideDone && st.have >= st.need) continue;
      if (q && !ni.itemName.toLowerCase().includes(q) && !ni.itemShort.toLowerCase().includes(q)) continue;
      visible.push({ id, item: ni, st });
    }
  }
  // Разбивка на две колонки (1,3,5 / 2,4,6).
  const left = visible.filter((_, i) => i % 2 === 0);
  const right = visible.filter((_, i) => i % 2 === 1);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Сводка ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStat icon="/icons/eft/03-items/loot-tier.svg" label="Всего предметов" value={summary.items} accent="default" />
        <SummaryStat icon="/icons/eft/04-progression/seasons/battlepass-wanted-item-icon.svg" label="Собрано" value={summary.have} accent="success" />
        <SummaryStat icon="/icons/eft/03-items/price-per-slot.svg" label="Осталось" value={summary.remaining} accent="primary" />
        <SummaryStat icon="/icons/eft/02-quests/quest-modify.svg" label="Докупить" value={summary.buy} accent="amber" />
      </div>
      <SummaryProgress label="Общий прогресс" value={summary.have} max={summary.need} />

      {/* ── Фильтры: поиск на полширины (скруглён) + gap 28px + кнопки равномерно (gap 8px) ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
        <div className="relative w-full sm:w-1/2">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск предмета…"
            className="h-9 w-full rounded-sm border border-lines-hover bg-(--color-base) pl-10 pr-4 font-blender-book text-type-caption text-text-primary placeholder:text-text-muted focus:border-(--primary) focus:outline-none"
          />
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <FilterChip on={hideDone} onClick={() => setHideDone((v) => !v)} lucide={<Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}>
            Скрыть готовые
          </FilterChip>
          <FilterChip on={firOnly} onClick={() => setFirOnly((v) => !v)} icon="/icons/eft/02-quests/side-quests.svg">
            Найдено в рейде
          </FilterChip>
          <FilterChip on={onlyHideout} onClick={() => setOnlyHideout((v) => !v)} icon="/icons/eft/04-progression/hideout-modules.svg">
            Строю Убежище
          </FilterChip>
          <FilterChip on={onlyQuests} onClick={() => setOnlyQuests((v) => !v)} icon="/icons/eft/quests-icon.svg">
            По заданиям
          </FilterChip>
        </div>
      </div>

      {/* ── Убежище ЧВК ── */}
      <HideoutModulesPanel stations={hideoutStations} />

      {/* ── Двухколоночная сетка (masonry: 2 независимые колонки) ── */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-lines-hover bg-(--color-base) px-6 py-12 text-center">
          <span className={`${MICRO} text-text-secondary`}>Ничего не найдено</span>
          <span className="font-blender-book text-type-caption text-text-muted">Измени фильтры или запрос.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-7 gap-y-3 sm:grid-cols-2">
          {[left, right].map((col, ci) => (
            <div key={ci} className="flex flex-col gap-3">
              {col.map((n) =>
                n.group ? (
                  <GroupRow key={n.id} group={n.group} expanded={open === n.id} onToggle={() => setOpen((o) => (o === n.id ? null : n.id))} />
                ) : (
                  <ItemRow
                    key={n.id}
                    item={n.item!}
                    st={n.st!}
                    expanded={open === n.id}
                    onToggle={() => setOpen((o) => (o === n.id ? null : n.id))}
                    onInc={(d) => distribute(n.st!.sources, d)}
                    onSetTotal={(v) => setTotal(n.st!.sources, v)}
                    stash={n.st!.stash}
                    onStash={(v) => setOwned(n.item!.itemId, v)}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  on,
  onClick,
  icon,
  lucide,
  children,
}: {
  on: boolean;
  onClick: () => void;
  icon?: string;
  lucide?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border px-2 font-blender-medium text-type-micro uppercase tracking-wider transition-colors ${
        on ? 'border-(--primary) bg-(--primary)/15 text-(--primary)' : 'border-lines-hover text-text-muted hover:text-text-secondary'
      }`}
    >
      {icon && (
        <span
          aria-hidden
          className={`h-4 w-4 shrink-0 mask-contain mask-center mask-no-repeat transition-colors ${on ? 'bg-(--primary)' : 'bg-text-muted'}`}
          style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
        />
      )}
      {lucide}
      {children}
    </button>
  );
}

/** Чип источника в развороте — микро-версия квест-ноды с карт.
 *  Квест: цвет/аватар трейдера + «УР. N+». Убежище: цвет --color-hideout + иконка модуля + уровень «0N». */
function SourceChip({ s }: { s: SrcState }) {
  const isQuest = s.kind === 'quest';
  const color = isQuest ? (TRADER_COLORS[s.nn] ?? TRADER_COLORS.stories) : 'var(--color-hideout)';
  return (
    <div
      className="flex items-center gap-2.5 rounded-sm border p-1.5"
      style={{
        borderColor: color,
        background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${color} 38%, transparent), #000000)`,
        boxShadow: `0 0 10px color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      {/* Аватар трейдера / иконка модуля 28px */}
      {isQuest ? (
        <img
          src={traderImg(s.nn)}
          alt=""
          loading="lazy"
          className="h-7 w-7 shrink-0 rounded-full border object-cover"
          style={{ borderColor: color }}
        />
      ) : (
        <span
          aria-hidden
          className="h-7 w-7 shrink-0 mask-contain mask-center mask-no-repeat bg-(--color-hideout)"
          style={{ maskImage: `url(${moduleIcon(s.nn)})`, WebkitMaskImage: `url(${moduleIcon(s.nn)})` }}
        />
      )}
      {/* Имя + мета */}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-blender-medium text-type-caption text-text-primary">{s.label}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-type-micro uppercase tracking-wide text-text-muted">
          {isQuest ? (
            <>
              <span className="text-text-secondary">{s.sub}</span>
              <span style={{ color }}>УР. {s.minLevel ?? 0}+</span>
            </>
          ) : (
            <span className="font-blender-medium tabular-nums text-(--color-hideout)">
              УР. {String(s.level ?? 0).padStart(2, '0')}
            </span>
          )}
          {s.fir && (
            <span className="flex items-center gap-0.5 text-nvg-green">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> в рейде
            </span>
          )}
          {s.maps?.map((m) =>
            MAP_SLUG[m] ? (
              <Link key={m} href={`/eft/maps/${MAP_SLUG[m]}`} className="text-text-secondary hover:text-(--primary)">
                {m}
              </Link>
            ) : (
              <span key={m}>{m}</span>
            ),
          )}
        </span>
      </span>
      <QtyControl value={s.collected} max={s.count} onChange={s.set} size="sm" />
    </div>
  );
}

/** Строка-предмет: ячейка 112px (счётчик) + имя/мета + разворот источников. */
function ItemRow({
  item,
  st,
  expanded,
  onToggle,
  onInc,
  onSetTotal,
  stash,
  onStash,
}: {
  item: NeededItem;
  st: ItemState;
  expanded: boolean;
  onToggle: () => void;
  onInc: (delta: number) => void;
  onSetTotal: (total: number) => void;
  stash: number;
  onStash: (v: number) => void;
}) {
  const done = st.have >= st.need;
  const pct = st.need > 0 ? Math.min(100, Math.round((st.have / st.need) * 100)) : 0;
  const bg = getTarkovBackgroundColor(item.backgroundColor);
  const qCount = st.sources.filter((s) => s.kind === 'quest').length;
  const hCount = st.sources.filter((s) => s.kind === 'hideout').length;

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-sm bg-card-menu ${done ? 'opacity-60' : ''}`}>
      {/* Горизонтальный прогресс по фону строки */}
      <span aria-hidden className="absolute inset-y-0 left-0 bg-nvg-green/25 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      <div className="relative flex items-center gap-3 p-2.5">
        <TrackCell
          iconSrc={item.itemIcon}
          alt={item.itemName}
          have={st.have}
          need={st.need}
          onInc={onInc}
          onSetTotal={onSetTotal}
          noFill
          bgColor={bg}
          sizeClass="h-28 w-28"
          topLeft={st.needFir > 0 ? <FirMark /> : undefined}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link
            href={item.slug ? `/eft/items/item/${item.slug}` : '#'}
            className="line-clamp-2 font-blender-medium text-sm uppercase leading-tight tracking-wide text-text-primary transition-colors hover:text-(--primary)"
            title={item.itemName}
          >
            {item.itemName}
          </Link>
          <span className="flex flex-wrap items-center gap-1.5">
            {qCount > 0 && (
              <MetaBadge variant="quest" icon="/icons/eft/quests-icon.svg">
                задание · {qCount}
              </MetaBadge>
            )}
            {hCount > 0 && (
              <MetaBadge variant="hideout" icon="/icons/eft/04-progression/hideout-modules.svg">
                убежище · {hCount}
              </MetaBadge>
            )}
            {st.needFir > 0 && (
              <MetaBadge variant="fir" icon="/icons/eft/02-quests/side-quests.svg">
                найдено в рейде · {st.needFir}
              </MetaBadge>
            )}
            {item.isQuestItem && (
              <span className="inline-flex h-5 items-center rounded-sm border border-lines-hover bg-lines-hover/30 px-1.5 font-blender-medium text-[0.625rem] uppercase tracking-widest text-text-secondary">
                только рейд
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className={`flex w-fit items-center gap-1 ${MICRO} transition-colors ${expanded ? 'text-(--primary)' : 'text-text-muted hover:text-(--primary)'}`}
          >
            Подробнее
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="relative flex flex-col gap-1.5 p-2.5 pt-0">
          {st.sources.map((s, i) => (
            <SourceChip key={i} s={s} />
          ))}
          {/* Стэш / докупить */}
          {!item.isQuestItem && (
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-lines-hover pt-2">
              <span className="flex items-center gap-2 text-type-caption">
                <span className="text-text-muted">в схроне</span>
                <QtyControl value={stash} max={9999} onChange={onStash} size="sm" />
              </span>
              <span className="font-blender-medium text-type-caption">
                <span className="text-text-muted">докупить </span>
                <span className={st.buyTotal > 0 ? 'text-tactical-amber' : 'text-nvg-green'}>{st.buyTotal}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Строка-группа any-of «N любых из категории». */
function GroupRow({
  group,
  expanded,
  onToggle,
}: {
  group: NeededData['groups'][number];
  expanded: boolean;
  onToggle: () => void;
}) {
  const rep = group.accepted[0];
  return (
    <div className="relative flex flex-col overflow-hidden rounded-sm bg-card-menu">
      <div className="relative flex items-center gap-3 p-2.5">
        <TrackCell
          iconSrc={rep?.icon ?? itemIconUrl('')}
          alt="Набор"
          have={0}
          need={group.count}
          onInc={() => {}}
          noFill
          sizeClass="h-28 w-28"
          topLeft={
            <span className="rounded-br-xs bg-(--color-darkbase)/90 px-1 py-0.5 font-blender-medium text-type-micro text-(--primary)">
              +{group.accepted.length}
            </span>
          }
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 font-blender-medium text-sm uppercase leading-tight tracking-wide text-text-primary">
            {group.count} любых · {group.questName}
          </span>
          <span className="flex items-center gap-x-2 font-blender-medium text-type-micro uppercase tracking-wide text-text-muted">
            {group.trader}
            {group.fir && (
              <span className="flex items-center gap-0.5 text-nvg-green">
                <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden /> в рейде
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className={`flex w-fit items-center gap-1 ${MICRO} transition-colors ${expanded ? 'text-(--primary)' : 'text-text-muted hover:text-(--primary)'}`}
          >
            принимаются ({group.accepted.length})
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="flex flex-wrap gap-1.5 border-t border-lines-hover p-2.5">
          {group.accepted.slice(0, 60).map((v) => (
            <span key={v.id} title={v.name} className="flex h-9 w-9 items-center justify-center rounded-xs border border-lines-hover bg-(--color-darkbase)">
              <img src={v.icon} alt={v.name} loading="lazy" className="h-full w-full object-contain p-0.5" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
