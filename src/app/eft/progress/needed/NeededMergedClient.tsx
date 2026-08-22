'use client';

// Объединённый трекер «Важные предметы» (слияние /tracker + /needed).
// Единый список ПО ПРЕДМЕТУ: агрегирует квесты + убежище. Ячейка 112px (TrackCell, без
// вертикальной заливки — прогресс показывает фон строки) — единственный счётчик; ЛКМ+1/ПКМ−1
// авто-распределяет по источникам (FiR-квесты → не-FiR квесты → убежище) в родные сторы.
// Разворот — точечный редакт источников + «в стэше/докупить». Раскладка: две masonry-колонки.
// Решения: docs/decisions/important-items-merge.md.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDownWideNarrow, Check, ChevronDown, Grid3x3, RotateCcw, Search } from 'lucide-react';
import { TrackCell } from '@/components/ui/kit';
import { QtyControl } from '@/components/ui/QtyControl';
import { type HideoutStationInfo } from '@/components/features/hideout/HideoutLevelsPanel';
import { HideoutModulesPanel, moduleIcon } from '@/components/features/hideout/HideoutModulesPanel';
import { NeededResetModal } from './NeededResetModal';
import { TRADER_COLORS } from '@/data/traderColors';
import { traderImg } from '@/lib/trader-utils';
import { useQuestStore } from '@/store/useQuestStore';
import { useHideoutStore } from '@/store/useHideoutStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { editionFloor } from '@/lib/hideout-edition';
import { computeStashOverlay } from '@/lib/stash-overlay';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { formatRub, formatCompactRub } from '@/lib/barter-calc';
import { itemIconUrl } from '@/lib/item-icon';
import type { NeededData, NeededItem, NeededMode } from '@/lib/needed-items';

const MAP_SLUG: Record<string, string> = {
  Таможня: 'customs', 'Улицы Таркова': 'streets-of-tarkov', Развязка: 'interchange', Резерв: 'reserve',
  Маяк: 'lighthouse', Ледокол: 'icebreaker', Завод: 'factory', Лабиринт: 'labyrinth', Берег: 'shoreline',
  Лес: 'woods', Эпицентр: 'ground-zero', Лаборатория: 'the-lab',
};

const MICRO = 'font-blender-medium text-type-micro uppercase tracking-widest';

// Потолок «в схроне» — практически недостижим, нужен лишь как кламп для bumpCount/QtyControl.
const STASH_MAX = 9999;

// «Оптовый» предмет: нужное кол-во ≥ порога (напр. 4500 патронов SOST одного квеста). Ячейка
// трекается как обычно (0/4500), но в ИТОГАХ сводки такая позиция весит 1, а не N юнитов —
// иначе одна патронная цель перекашивает Осталось/Собрано/Докупить (§ «разметка не считает» —
// правило подачи, не доменной логики). Валюта отсекается раньше (CURRENCY_IDS в ридере).
const BULK_THRESHOLD = 1000;

// Сортировка «новичок → профи». Убежище (уровень станции) и квесты (minLevel игрока) — разные
// шкалы; сводим уровень станции к ПРИМЕРНОМУ игровому уровню, к которому его обычно строят, чтобы
// оба источника легли на одну ось «когда впервые нужен». Числа — прикидка, легко подкрутить.
const HIDEOUT_STAGE: Record<number, number> = { 1: 1, 2: 7, 3: 15, 4: 25, 5: 35 };
const hideoutStage = (level: number): number => HIDEOUT_STAGE[level] ?? level * 8;

/** «Когда впервые нужен» — минимум по источникам на общей оси игрового уровня (первично в сорте). */
function earliestOf(ni: NeededItem): number {
  let e = Infinity;
  for (const q of ni.quests) e = Math.min(e, q.minLevel || 0);
  for (const h of ni.hideout) e = Math.min(e, hideoutStage(h.level));
  return Number.isFinite(e) ? e : 999;
}
/** «Важность» — скольким источникам нужен (частота = универсальная полезность; вторично в сорте). */
const importanceOf = (ni: NeededItem): number => ni.quests.length + ni.hideout.length;

// Методы сортировки списка. Прогрессия/важность/алфавит — статичны (от прогресса не зависят);
// «осталось»/«дороже» зависят от собранного → порядок снимается СНАПШОТОМ на смену сорта, а не
// вживую (иначе строки прыгали бы под курсором на +/−). Порядок в массиве = порядок в меню.
type SortMode = 'progression' | 'remaining' | 'buycost' | 'importance' | 'alpha' | 'original';
const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'progression', label: 'Новичок → Профи' },
  { key: 'remaining', label: 'Больше осталось' },
  { key: 'buycost', label: 'Дороже сверху (₽)' },
  { key: 'importance', label: 'По важности' },
  { key: 'alpha', label: 'По алфавиту (А→Я)' },
  { key: 'original', label: 'Исходный' },
];

/** FiR-маркер (найдено в рейде) — фрейм 36×36 в углу ячейки + иконка side-quests 22×22 (#BDA550). */
function FirMark() {
  return (
    <span
      title="Найдено в рейде"
      className="flex h-5 w-5 items-center justify-center"
    >
      <span
        aria-hidden
        className="h-3 w-3 mask-contain mask-center mask-no-repeat bg-(--color-rarity-legendary)"
        style={{ maskImage: 'url(/icons/eft/02-quests/side-quests.svg)', WebkitMaskImage: 'url(/icons/eft/02-quests/side-quests.svg)' }}
      />
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
function SummaryStat({ icon, label, value, accent, sub }: { icon: string; label: string; value: number; accent: keyof typeof STAT_ACCENT; sub?: string }) {
  const a = STAT_ACCENT[accent];
  return (
    <div className="flex items-center gap-3 rounded-md border border-lines-hover bg-card-menu/40 p-3">
      <span
        aria-hidden
        className={`h-6 w-6 shrink-0 ${a.icon} mask-contain mask-center mask-no-repeat`}
        style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
      />
      <span className="flex-1 leading-tight">
        <span className={`${MICRO} block text-text-muted`}>{label}</span>
        {sub && <span className="mt-0.5 block font-blender-medium text-type-micro tabular-nums text-text-secondary">{sub}</span>}
      </span>
      <AnimatedNumber value={value} className={`font-blender-medium text-[1.75rem] leading-none ${a.num}`} />
    </div>
  );
}

/** Общий прогресс-бар: 12 делений под сетку, %, бегунок-указатель с текущим значением, анимация. */
function SummaryProgress({
  value,
  max,
  label,
  divisions = 12,
  onReset,
}: {
  value: number;
  max: number;
  label: string;
  divisions?: number;
  onReset?: () => void;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const ptr = Math.min(98, Math.max(2, pct)); // держим бегунок в пределах шкалы
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-2">
          <span className={`${MICRO} text-text-muted`}>{label}</span>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Сбросить весь прогресс сбора"
              className="flex items-center gap-1 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors hover:text-danger"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Сброс
            </button>
          )}
        </span>
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
        <div className="absolute inset-x-0 bottom-0 h-2 overflow-hidden rounded-xs border border-lines-hover bg-(--color-darkbase)">
          <div className="h-full bg-(--primary)/80 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
        {/* Деления под сетку */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2">
          {Array.from({ length: divisions - 1 }).map((_, i) => (
            <span key={i} aria-hidden className="absolute top-0 h-full w-0.5 bg-(--color-base)" style={{ left: `${((i + 1) / divisions) * 100}%` }} />
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
  /** BSG id квеста (только kind='quest') — ссылка на карту квестов `/eft/questmap?quest=`. */
  questId?: string;
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
  dataByMode,
  hideoutStations,
}: {
  dataByMode: Record<NeededMode, NeededData>;
  hideoutStations: HideoutStationInfo[];
}) {
  // Режим — из активного профиля ЧВК (usePlayerStore, PVE→pve, иначе regular). Стор персистится
  // в localStorage и регидратируется ПОСЛЕ маунта: SSR и первый клиентский рендер дают дефолт
  // (regular) → совпадают (нет hydration-mismatch), затем pve-профиль перещёлкивает набор. Тот же
  // паттерн, что у прочих persist-сторов страницы (прогресс квестов/убежища).
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const mode: NeededMode = activeProfile?.mode === 'PVE' ? 'pve' : 'regular';
  const data = dataByMode[mode];

  const questProgress = useQuestStore((s) => s.itemProgress);
  const completedQuests = useQuestStore((s) => s.completedQuests);
  const setItemCount = useQuestStore((s) => s.setItemCount);
  const incrementItem = useQuestStore((s) => s.incrementItem);
  const decrementItem = useQuestStore((s) => s.decrementItem);
  const clearQuestProgress = useQuestStore((s) => s.clearItemProgress);
  const hideoutLevels = useHideoutStore((s) => s.levels);
  const clearHideoutProgress = useHideoutStore((s) => s.clearItemProgress);
  const ownedItems = useInventoryStore((s) => s.ownedItems);
  const setOwned = useInventoryStore((s) => s.setCount);
  const bumpOwned = useInventoryStore((s) => s.bumpCount);

  const completed = useMemo(() => new Set(completedQuests), [completedQuests]);

  const [search, setSearch] = useState('');
  const [hideDone, setHideDone] = useState(true);
  const [firOnly, setFirOnly] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [onlyHideout, setOnlyHideout] = useState(false);
  const [onlyQuests, setOnlyQuests] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  // Сортировка (дефолт — прогрессия) + открытость меню «Фильтры и сортировка».
  const [sortMode, setSortMode] = useState<SortMode>('progression');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        questId: q.questId,
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
    const stashOwned = ownedItems[ni.itemId] ?? 0;
    for (const h of ni.hideout) {
      // Издание тоже «строит» модули (TUE → Круг сектантов): editionFloor поверх сохранённого уровня.
      if (h.level <= Math.max(hideoutLevels[h.station] ?? 0, editionFloor(h.station, activeProfile?.edition))) continue;
      // Убежищный itemProgress мигрирован в схрон и очищается (§ИТЕРАЦИЯ 5): «собрано» больше не
      // хранится отдельно, покрытие идёт ТОЛЬКО через computeStashOverlay(stash). collected здесь —
      // показ схрона предмета (кламп по потребности уровня); set/bump/get двигают ОБЩИЙ схрон-счётчик.
      const collected = Math.min(h.count, stashOwned);
      need += h.count;
      hideoutNeed += h.count;
      if (h.fir) needFir += h.count;
      sources.push({
        kind: 'hideout',
        label: h.stationName,
        sub: `Ур. ${h.level}`,
        nn: h.station,
        count: h.count,
        collected,
        fir: h.fir,
        level: h.level,
        set: (n) => setOwned(ni.itemId, Math.max(0, n)),
        bump: (d) => bumpOwned(ni.itemId, d, STASH_MAX),
        get: () => useInventoryStore.getState().ownedItems[ni.itemId] ?? 0,
      });
    }

    const stash = stashOwned;
    const ov = computeStashOverlay({ stash, hideoutNeed, questSoftNeed: questSoft, questFirNeed: questFir });
    // «Собрано» для убежища = схрон, фактически выделенный на убежищную нужду. Считаем ОДИН раз из
    // оверлея (stashToHideout ≤ min(stash, hideoutNeed)), а не на каждый незастроенный уровень —
    // при едином схроне общий материал (болты для нескольких модулей) иначе завышал бы have.
    have += ov.stashToHideout;
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

  // Состояние всех предметов — ОДИН пересчёт за рендер, мемо по слоям сторов. Раньше stateOf
  // звался дважды (в summary + при построении visible в теле рендера), и visible пересчитывал
  // все 397 состояний даже на тоглы open/поиск. Теперь и сводка, и visible, и сорт читают эту карту.
  const statesById = useMemo(() => {
    const m = new Map<string, ItemState>();
    for (const ni of data.items) m.set(ni.itemId, stateOf(ni));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.items, questProgress, hideoutLevels, ownedItems, completed, activeProfile?.edition]);

  // Порядок отображения по выбранному методу. «original» — как отдал ридер. Остальные сортируют
  // копию базового списка. Прогресс-зависимые метрики (remaining/buycost) берутся из statesById
  // СНАПШОТОМ: statesById намеренно вне deps → на +/− память не пересобирается, строки не прыгают;
  // пересорт только при смене sortMode или данных (pve). Статичные метрики — из самого предмета.
  const orderedIds = useMemo(() => {
    const base = [...data.items.map((i) => i.itemId), ...data.groups.map((g) => `g:${g.key}`)];
    if (sortMode === 'original') return base;

    const metric = (id: string) => {
      if (id.startsWith('g:')) {
        const g = groupById.get(id.slice(2));
        return { earliest: g?.minLevel ?? 999, importance: 1, total: g?.count ?? 0, remaining: g?.count ?? 0, buycost: 0, name: g?.questName ?? '' };
      }
      const ni = byId.get(id);
      const st = statesById.get(id);
      return {
        earliest: ni ? earliestOf(ni) : 999,
        importance: ni ? importanceOf(ni) : 0,
        total: ni?.neededTotal ?? 0,
        remaining: st ? Math.max(0, st.need - st.have) : 0,
        buycost: st && ni?.buyPrice ? st.buyTotal * ni.buyPrice : 0,
        name: ni?.itemName ?? '',
      };
    };

    return [...base].sort((a, b) => {
      const ka = metric(a);
      const kb = metric(b);
      switch (sortMode) {
        case 'remaining': return kb.remaining - ka.remaining || ka.name.localeCompare(kb.name);
        case 'buycost': return kb.buycost - ka.buycost || ka.name.localeCompare(kb.name);
        case 'importance': return kb.importance - ka.importance || ka.earliest - kb.earliest || ka.name.localeCompare(kb.name);
        case 'alpha': return ka.name.localeCompare(kb.name);
        default: /* progression */ return ka.earliest - kb.earliest || kb.importance - ka.importance || kb.total - ka.total || ka.name.localeCompare(kb.name);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- statesById снимается снапшотом на смену sortMode/данных (не live)
  }, [sortMode, data.items, data.groups, byId, groupById]);

  // Меню «Фильтры и сортировка»: закрытие по клику-вне и Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Сводка — из готовой карты состояний.
  const summary = useMemo(() => {
    let need = 0;
    let have = 0;
    let buy = 0;
    let buyRub = 0;
    let items = 0;
    for (const ni of data.items) {
      const st = statesById.get(ni.itemId);
      if (!st || st.need === 0) continue;
      items++;
      // Оптовые (4500 патронов и т.п.) весят в итогах 1 позицию, а не N юнитов: need→1,
      // have→готово?1:0, buy→надо докупать?1:0. ₽ докупки остаётся РЕАЛЬНЫМ (деньги — деньги).
      const bulk = ni.neededTotal >= BULK_THRESHOLD;
      need += bulk ? 1 : st.need;
      have += bulk ? (st.have >= st.need ? 1 : 0) : st.have;
      buy += bulk ? (st.buyTotal > 0 ? 1 : 0) : st.buyTotal;
      if (ni.buyPrice) buyRub += st.buyTotal * ni.buyPrice;
    }
    return { need, have, buy, buyRub, items, remaining: Math.max(0, need - have) };
  }, [data.items, statesById]);

  const q = search.trim().toLowerCase();

  // Видимые узлы в снап-порядке (предметы + группы), с фильтрами.
  type Node = { id: string; item?: NeededItem; group?: (typeof data.groups)[number]; st?: ItemState };
  const visible: Node[] = [];
  for (const id of orderedIds) {
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
      const st = statesById.get(ni.itemId);
      if (!st || st.need === 0) continue;
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
        <SummaryStat icon="/icons/eft/02-quests/quest-modify.svg" label="Докупить" value={summary.buy} accent="amber" sub={summary.buyRub > 0 ? `~₽ ${formatCompactRub(summary.buyRub)}` : undefined} />
      </div>
      <SummaryProgress
        label="Общий прогресс"
        value={summary.have}
        max={summary.need}
        onReset={() => setConfirmReset(true)}
      />
      <NeededResetModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          clearQuestProgress();
          clearHideoutProgress();
        }}
      />

      {/* ── Поиск + фильтры-кнопки + дропдаун сортировки (одна строка) ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-2">
        <div className="relative w-full sm:min-w-40 sm:flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск предмета…"
            className="h-9 w-full rounded-sm border border-lines-hover bg-(--color-base) pl-10 pr-4 font-blender-book text-type-caption text-text-primary placeholder:text-text-muted focus:border-(--primary) focus:outline-none"
          />
        </div>
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

        {/* Дропдаун — ТОЛЬКО сортировка (фильтры остаются кнопками) */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            className={`flex h-9 items-center gap-2 rounded-sm border px-3 font-blender-medium text-type-micro uppercase tracking-wider transition-colors ${
              menuOpen ? 'border-(--primary) text-(--primary)' : 'border-lines-hover text-text-muted hover:text-text-secondary'
            }`}
          >
            <ArrowDownWideNarrow className="h-4 w-4 shrink-0" aria-hidden />
            Сортировка
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 rounded-md border border-lines-hover bg-(--color-base) p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              {SORT_OPTIONS.map((o) => {
                const active = sortMode === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => {
                      setSortMode(o.key);
                      setMenuOpen(false);
                    }}
                    className={`flex h-8 w-full items-center justify-between rounded-sm px-2.5 font-blender-medium text-type-caption transition-colors ${
                      active ? 'bg-(--primary)/15 text-(--primary)' : 'text-text-secondary hover:bg-lines-hover/40'
                    }`}
                  >
                    {o.label}
                    {active && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Ненавязчивый вход в визуальную сетку схрона */}
        <Link
          href="/eft/progress/stash"
          title="Открыть визуальную сетку схрона"
          className="flex h-9 shrink-0 items-center gap-2 rounded-sm border border-lines-hover px-3 font-blender-medium text-type-micro uppercase tracking-wider text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <Grid3x3 className="h-4 w-4 shrink-0" aria-hidden />
          Мой схрон
        </Link>
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
                    onStashDelta={(d) => bumpOwned(n.item!.itemId, d, STASH_MAX)}
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

/** Кнопка-фильтр списка (тоггл). Иконка-маска ИЛИ lucide-нода + подпись; активна — рамка/фон primary. */
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
      className={`flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border px-3 font-blender-medium text-type-micro uppercase tracking-wider transition-colors ${
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
          className="h-7 w-7 shrink-0 rounded-xs object-cover"
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
        {isQuest && s.questId ? (
          <Link
            href={`/eft/questmap?quest=${s.questId}`}
            title="Открыть на карте квестов"
            className="truncate font-blender-medium text-type-caption text-text-primary transition-colors hover:text-(--primary)"
          >
            {s.label}
          </Link>
        ) : (
          <span className="truncate font-blender-medium text-type-caption text-text-primary">{s.label}</span>
        )}
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
            <span className="flex items-center gap-1 text-nvg-green">
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 mask-contain mask-center mask-no-repeat bg-nvg-green"
                style={{ maskImage: 'url(/icons/eft/02-quests/side-quests.svg)', WebkitMaskImage: 'url(/icons/eft/02-quests/side-quests.svg)' }}
              />
              в рейде
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
      {/* Итого нужно на этот квест/модуль + разделитель у минуса */}
      <span className="flex shrink-0 flex-col items-center leading-none" title={`Нужно всего: ${s.count}`}>
        <span className="font-blender-medium text-sm tabular-nums text-text-primary">{s.count}</span>
        <span className="text-[9px] uppercase tracking-wide text-text-muted">нужно</span>
      </span>
      <span aria-hidden className="h-8 w-px shrink-0 bg-lines-hover" />
      <QtyControl value={s.collected} max={s.count} onChange={s.set} onDelta={s.bump} size="sm" />
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
  onStashDelta,
}: {
  item: NeededItem;
  st: ItemState;
  expanded: boolean;
  onToggle: () => void;
  onInc: (delta: number) => void;
  onSetTotal: (total: number) => void;
  stash: number;
  onStash: (v: number) => void;
  onStashDelta: (delta: number) => void;
}) {
  const done = st.have >= st.need;
  const bg = getTarkovBackgroundColor(item.backgroundColor);
  const qCount = st.sources.filter((s) => s.kind === 'quest').length;
  const hCount = st.sources.filter((s) => s.kind === 'hideout').length;

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-sm border border-(--color-card-menu) bg-(--color-darkbase) ${done ? 'opacity-60' : ''}`}>
      <div className="relative flex items-start gap-3 p-2.5">
        <TrackCell
          iconSrc={item.itemIcon}
          alt={item.itemName}
          have={st.have}
          need={st.need}
          onInc={onInc}
          onSetTotal={onSetTotal}
          bgColor={bg}
          sizeClass="h-28 w-28"
          bottomLeft={st.needFir > 0 ? <FirMark /> : undefined}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <div className="flex flex-col gap-0.5">
            <Link
              href={item.slug ? `/eft/items/item/${item.slug}` : '#'}
              className="line-clamp-2 font-blender-medium text-base uppercase leading-tight tracking-wide text-text-primary transition-colors hover:text-(--primary)"
              title={item.itemName}
            >
              {item.itemName}
            </Link>
            {item.itemShort && item.itemShort !== item.itemName && (
              <span className="font-blender-book text-xs uppercase tracking-wide text-text-muted">{item.itemShort}</span>
            )}
          </div>
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
            className={`flex w-fit items-center gap-1 font-blender-medium text-xs uppercase tracking-widest transition-colors ${expanded ? 'text-(--primary)' : 'text-text-muted hover:text-(--primary)'}`}
          >
            Подробнее
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
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
                <QtyControl value={stash} max={STASH_MAX} onChange={onStash} onDelta={onStashDelta} size="sm" />
              </span>
              <span className="font-blender-medium text-type-caption">
                <span className="text-text-muted">докупить </span>
                <span className={st.buyTotal > 0 ? 'text-tactical-amber' : 'text-nvg-green'}>{st.buyTotal}</span>
                {st.buyTotal > 0 && item.buyPrice != null && (
                  <span className="text-text-muted"> · ~{formatRub(st.buyTotal * item.buyPrice)}</span>
                )}
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
    <div className="relative flex flex-col overflow-hidden rounded-sm border border-(--color-card-menu) bg-(--color-darkbase)">
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
              <span className="flex items-center gap-1 text-nvg-green">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 mask-contain mask-center mask-no-repeat bg-nvg-green"
                  style={{ maskImage: 'url(/icons/eft/02-quests/side-quests.svg)', WebkitMaskImage: 'url(/icons/eft/02-quests/side-quests.svg)' }}
                />
                в рейде
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
