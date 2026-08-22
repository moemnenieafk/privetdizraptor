'use client';

// Клиент раздела «Прибыль убежища» (T7 craft-profit-rework): интро-блок + вкладки модулей +
// единый ряд контролов + грид карточек RecipeCard. Ридер (page.tsx) отдаёт СЫРЫЕ компоненты
// цены; всю экономику/фильтр/сортировку считаем реактивно через computeCraftEconomy (T2) в
// мемо-хелперах (§4.7 — не в JSX). Навыки — read-only индикаторы (уровни из Досье ЧВК), они и
// тумблер «пустой бак» кормят те же формулы.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownWideNarrow, Check, ChevronDown, Search, TrendingUp } from 'lucide-react';
import { useHideoutStore } from '@/store/useHideoutStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePmcStatsStore } from '@/store/usePmcStatsStore';
import { useManualProfileStore } from '@/store/useManualProfileStore';
import { useQuestStore } from '@/store/useQuestStore';
import { resolveSkillLevel } from '@/lib/tarkov/player-view-merge';
import { editionFloor, ownsAnyEdition } from '@/lib/hideout-edition';
import { computeCraftEconomy, type CraftEconomy } from '@/lib/craft-profit';
import { RecipeCard } from '@/components/features/hideout/RecipeCard';
import { useCraftPinStore } from '@/store/useCraftPinStore';
import { ModuleFilterTabs, type ModuleTabDatum } from '@/components/features/hideout/ModuleFilterTabs';
import { SKILL_ICONS } from '@/components/features/adaptive/skill-icons';
import type { HideoutStationInfo } from '@/db/hideout';

/** Метод сортировки списка крафтов. Порядок в SORT_OPTIONS = порядок в меню. */
export type CraftSortMode = 'pph' | 'profit' | 'roi' | 'duration' | 'cost' | 'alpha';

const SORT_OPTIONS: { key: CraftSortMode; label: string }[] = [
  { key: 'pph', label: '₽/час' },
  { key: 'profit', label: 'Прибыль ₽' },
  { key: 'roi', label: 'ROI %' },
  { key: 'duration', label: 'Время (короче)' },
  { key: 'cost', label: 'Дешевле вход' },
  { key: 'alpha', label: 'Алфавит' },
];

/** Мета предмета слота крафта (общая для входа и выхода). */
export interface CraftSlotItem {
  id: string;
  name: string;
  shortName: string;
  image512pxLink?: string;
  /** Имя цвета слота (violet/blue/grey…) — фон ячейки по редкости. */
  backgroundColor?: string;
  /** normalizedName из зеркала prices — кросс-линк на карточку предмета. */
  slug?: string;
}

/** Вход рецепта: сырые компоненты цены (клиент считает стоимость сам). */
export interface CraftInput {
  item: CraftSlotItem;
  count: number;
  /** Дешевейшая cash-покупка из buyFor (₽). */
  unitBuy: number;
  /** Топливный бак — для тумблера «пустой бак» (считается как sellTrader·0.1). */
  isFuel: boolean;
  /** Лучшая продажа трейдеру за штуку — база «пустого бака». */
  sellTrader: number;
  /** Инструмент (не расходуется) — в стоимость крафта не идёт (§1.1 ресёрча). */
  isTool?: boolean;
}

/** Выход рецепта: сырые компоненты цены (basePrice для налога + два канала продажи). */
export interface CraftOutput {
  item: CraftSlotItem;
  count: number;
  /** items.basePrice — база расчёта налога барахолки. */
  basePrice: number;
  /** Максимальная продажа трейдеру за штуку (БЕЗ барахолки). */
  bestTraderSell: number;
  /** Цена барахолки за штуку (lastLowPrice ?? avg24hPrice). */
  fleaPrice: number;
  /** Дешевейшая cash-покупка выхода за штуку (₽) — база «Экономии». 0, если не купить. */
  buyBest: number;
}

export interface StationGate {
  stations: { name: string; level: number }[];
  traders: { name: string; level: number }[];
  skills: { name: string; level: number }[];
}

export interface ProcessedCraft {
  id: string;
  stationName: string;
  stationNormalized: string;
  stationIcon: string | null;
  level: number;
  duration: number;
  required: CraftInput[];
  reward: CraftOutput[];
  gate?: StationGate;
  /** id квеста-анлока крафта (crafts.taskUnlockId). Резолв «пройден?» — на клиенте. */
  taskUnlock?: string;
  /** Имя квеста-анлока для лейбла чипа (если сджойнено ридером). */
  taskUnlockName?: string;
  /** normalizedName торговца квеста-анлока — для аватара/цвета квест-нод-чипа. */
  taskUnlockTrader?: string;
  /** minPlayerLevel квеста-анлока — для «УР. N+» в чипе. */
  taskUnlockMinLevel?: number;
  /** Коды изданий-анлоков tarkov.dev (crafts.gameEditions). Резолв «есть?» — на клиенте. */
  gameEditions?: string[];
  /** id квест-предметов на входе (crafts.requiredQuestItems) — для нейтрального чипа. */
  requiredQuestItems?: string[];
}

/** ID навыков в SKILL_CATALOG (resolveSkillLevel читает по ним). */
const SKILL_CRAFTING = 'Crafting';
const SKILL_HIDEOUT_MGMT = 'HideoutManagement';

/**
 * Метрика крафта под текущие навыки/тумблеры. Мемоизируется на уровне списка (не в карточке),
 * чтобы фильтр/сортировка били по тем же числам, что показывает карточка (§4.7).
 */
function craftEconomy(
  c: ProcessedCraft,
  craftingLevel: number,
  hideoutMgmtLevel: number,
  intelCenterBuilt: boolean,
  emptyFuel: boolean,
): CraftEconomy {
  const out = c.reward[0];
  return computeCraftEconomy({
    inputs: c.required.map((r) => ({
      unitBuy: r.unitBuy,
      count: r.count,
      isFuel: r.isFuel,
      sellTrader: r.sellTrader,
      isTool: r.isTool,
    })),
    output: {
      basePrice: out?.basePrice ?? 0,
      bestTraderSell: out?.bestTraderSell ?? 0,
      fleaPrice: out?.fleaPrice ?? 0,
      count: out?.count ?? 1,
      buyBest: out?.buyBest ?? 0,
    },
    baseDurationSec: c.duration,
    craftingLevel,
    hideoutMgmtLevel,
    intelCenterBuilt,
    emptyFuel,
  });
}

/** Разрешённый доступ по профилю: квест пройден (если требуется) и издание есть (если требуется). */
interface CraftAccess {
  questDone: boolean;
  editionOwned: boolean;
}

/**
 * Резолв доступа крафта из профиля: нет taskUnlock → квест не требуется (questDone=true);
 * нет gameEditions → издание не требуется (editionOwned=true). До маунта — как «требование снято»
 * (persist-сторы читаются только на клиенте, иначе hydration mismatch).
 */
function resolveAccess(
  c: ProcessedCraft,
  completedSet: Set<string>,
  playerEdition: string | null | undefined,
  mounted: boolean,
): CraftAccess {
  return {
    questDone: !c.taskUnlock || !mounted || completedSet.has(c.taskUnlock),
    editionOwned: !c.gameEditions?.length || !mounted || ownsAnyEdition(playerEdition, c.gameEditions),
  };
}

/** Доступность = станция построена ≥ уровня И квест пройден (или не нужен) И издание есть (или не нужно). */
function isAvailable(c: ProcessedCraft, builtLevel: number, access: CraftAccess): boolean {
  return builtLevel >= c.level && access.questDone && access.editionOwned;
}

const SORTERS: Record<CraftSortMode, (m: CraftEconomy) => number> = {
  pph: (m) => m.profitPerHour,
  profit: (m) => m.profit,
  roi: (m) => m.roi,
  duration: (m) => -m.effDurationSec, // короче → выше
  cost: (m) => -m.totalCost, // дешевле → выше
  alpha: () => 0, // алфавит сортируется отдельно по имени выхода
};

export function CraftProfitClient({
  crafts,
  hideoutStations: _hideoutStations,
}: {
  crafts: ProcessedCraft[];
  hideoutStations: HideoutStationInfo[];
}) {
  // mounted-гард: persist-сторы читаем только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pinnedIds = useCraftPinStore((s) => s.pinned);

  // Профиль: построенные уровни, издание (даёт floor), навыки (загруженный + ручные оверрайды).
  const levels = useHideoutStore((s) => s.levels);
  const edition = usePlayerStore((s) => s.profiles.find((p) => p.id === s.activeProfileId)?.edition);
  const skillView = usePmcStatsStore((s) => s.view);
  const manualSkills = useManualProfileStore((s) => s.skills);
  const completedQuests = useQuestStore((s) => s.completedQuests);

  // Доступ каждого крафта по профилю (квест-анлок + издание). Один проход, переиспользуется
  // фильтром/сортировкой/карточками — как и метрика (§4.7, не в JSX).
  const accessMap = useMemo(() => {
    const completedSet = new Set(completedQuests);
    const m = new Map<string, CraftAccess>();
    for (const c of crafts) m.set(c.id, resolveAccess(c, completedSet, edition, mounted));
    return m;
  }, [crafts, completedQuests, edition, mounted]);

  // Построенный уровень станции с учётом издания. До маунта — 0 (hydration).
  const builtLevel = (nn: string) =>
    mounted ? Math.max(levels[nn] ?? 0, editionFloor(nn, edition)) : 0;

  // Навыки — read-only индикаторы: уровни берём прямо из профиля (Досье ЧВК) через
  // resolveSkillLevel. До маунта — 0 (persist читается только на клиенте, иначе hydration).
  // Эти же значения кормят экономику (metrics) и карточки.
  const craftingLevel = mounted ? resolveSkillLevel(skillView, manualSkills, SKILL_CRAFTING) : 0;
  const hideoutMgmtLevel = mounted ? resolveSkillLevel(skillView, manualSkills, SKILL_HIDEOUT_MGMT) : 0;

  // Разведцентр ур.3+ построен → скидка налога барахолки.
  const intelCenterBuilt = builtLevel('intelligence-center') >= 3;

  // Тумблеры и контролы.
  const [emptyFuel, setEmptyFuel] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyProfitable, setOnlyProfitable] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [hideLocked, setHideLocked] = useState(false);
  const [sort, setSort] = useState<CraftSortMode>('pph');
  // Дефолт — вкладка «ТОП» (прибыльные крафты по всем станциям); иначе stationKey.
  const [activeStation, setActiveStation] = useState<string>('top');

  // Снапшот метрики по каждому крафту под текущие навыки/тумблеры — один проход, переиспользуется
  // фильтром/сортировкой/вкладками. Пересчёт только когда меняются входные условия (§4.7).
  const metrics = useMemo(() => {
    const m = new Map<string, CraftEconomy>();
    for (const c of crafts) {
      m.set(c.id, craftEconomy(c, craftingLevel, hideoutMgmtLevel, intelCenterBuilt, emptyFuel));
    }
    return m;
  }, [crafts, craftingLevel, hideoutMgmtLevel, intelCenterBuilt, emptyFuel]);

  // Счётчик прибыльных крафтов по всем станциям — число на плитке «ТОП» (динамично от навыков/тумблеров).
  const topCount = useMemo(
    () => crafts.reduce((n, c) => n + ((metrics.get(c.id)?.profit ?? 0) > 0 ? 1 : 0), 0),
    [crafts, metrics],
  );

  // Вкладки модулей: builtLevel из профиля, availCount = крафтов на текущем уровне, totalCount = всего.
  const moduleTabs = useMemo<ModuleTabDatum[]>(() => {
    const map = new Map<string, ModuleTabDatum & { maxPph: number }>();
    for (const c of crafts) {
      const key = c.stationNormalized || c.stationName;
      const e =
        map.get(key) ??
        {
          key,
          name: c.stationName,
          normalizedName: c.stationNormalized,
          builtLevel: builtLevel(c.stationNormalized),
          availCount: 0,
          totalCount: 0,
          maxPph: -Infinity,
        };
      e.totalCount++;
      if (c.level <= e.builtLevel) e.availCount++;
      e.maxPph = Math.max(e.maxPph, metrics.get(c.id)?.profitPerHour ?? 0);
      map.set(key, e);
    }
    return [...map.values()]
      .sort((a, b) => b.maxPph - a.maxPph)
      .map(({ maxPph: _maxPph, ...t }) => t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crafts, metrics, levels, edition, mounted]);

  // Фильтрация: поиск по выходу, «только прибыльные», «доступно сейчас», «скрыть заблокированные», вкладка.
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return crafts.filter((c) => {
      const m = metrics.get(c.id);
      if (!m) return false;
      const access = accessMap.get(c.id) ?? { questDone: true, editionOwned: true };
      const available = isAvailable(c, builtLevel(c.stationNormalized), access);
      if (onlyProfitable && m.profit <= 0) return false;
      if (onlyAvailable && !available) return false;
      if (hideLocked && !available) return false;
      // Вкладка «ТОП» — только прибыльные по всем станциям; stationKey — фильтр этой станции.
      if (activeStation === 'top') {
        if (m.profit <= 0) return false;
      } else if ((c.stationNormalized || c.stationName) !== activeStation) {
        return false;
      }
      if (q) {
        const hit = c.reward.some(
          (r) => r.item.name.toLowerCase().includes(q) || r.item.shortName.toLowerCase().includes(q),
        );
        if (!hit) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crafts, metrics, accessMap, onlyProfitable, onlyAvailable, hideLocked, activeStation, q, levels, edition, mounted]);

  // Сортировка: 6 методов. Алфавит — по имени выхода; остальные — по метрике (desc).
  const sorted = useMemo(() => {
    const rewardName = (c: ProcessedCraft) => c.reward[0]?.item.name ?? '';
    const arr = [...filtered];
    if (sort === 'alpha') {
      arr.sort((a, b) => rewardName(a).localeCompare(rewardName(b)));
      return arr;
    }
    const key = SORTERS[sort];
    arr.sort((a, b) => {
      const ma = metrics.get(a.id);
      const mb = metrics.get(b.id);
      return (mb ? key(mb) : 0) - (ma ? key(ma) : 0);
    });
    return arr;
  }, [filtered, sort, metrics]);

  // Закреплённые (скрепка) — из ПОЛНОГО списка, независимо от фильтров/вкладок; из основного грида
  // исключаем (без дублей). Порядок — как закрепляли.
  const pinnedSet = useMemo(() => new Set(mounted ? pinnedIds : []), [pinnedIds, mounted]);
  const pinnedCrafts = useMemo(
    () =>
      mounted
        ? pinnedIds
            .map((id) => crafts.find((c) => c.id === id))
            .filter((c): c is ProcessedCraft => Boolean(c))
        : [],
    [pinnedIds, crafts, mounted],
  );
  const visible = useMemo(() => sorted.filter((c) => !pinnedSet.has(c.id)), [sorted, pinnedSet]);

  // Единый рендер карточки — переиспользуется секцией «Закреплённые» и основным гридом.
  const renderCard = (c: ProcessedCraft) => {
    const access = accessMap.get(c.id);
    return (
      <RecipeCard
        key={c.id}
        craft={c}
        builtStationLevel={builtLevel(c.stationNormalized)}
        craftingLevel={craftingLevel}
        hideoutMgmtLevel={hideoutMgmtLevel}
        intelCenterBuilt={intelCenterBuilt}
        emptyFuel={emptyFuel}
        questDone={access?.questDone ?? true}
        editionOwned={access?.editionOwned ?? true}
      />
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Заголовок/описание раздела — в SectionHubNav (headerConfig p-hideout-craft), не дублируем. */}
      {/* 1. Единый ряд контролов: поиск + read-only скилл-индикаторы + иконки-фильтры +
          профиль-ссылка + сортировка (Figma 3015-1878). Над вкладками станций. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Поиск. */}
        <div className="relative min-w-40 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск рецепта производства…"
            className="h-9 w-full rounded-sm border border-lines-hover bg-(--color-base) pl-10 pr-4 font-blender-book text-type-caption text-text-primary placeholder:text-text-muted focus:border-(--primary) focus:outline-none"
          />
        </div>

        {/* Read-only индикаторы навыков — уровни из Досье ЧВК. */}
        <SkillIndicator
          iconSrc={SKILL_ICONS.Crafting?.src ?? ''}
          level={craftingLevel}
          label="Ручное производство"
        />
        <SkillIndicator
          iconSrc={SKILL_ICONS.HideoutManagement?.src ?? ''}
          level={hideoutMgmtLevel}
          label="Управление убежищем"
        />

        {/* Иконки-фильтры (36×36). */}
        <IconToggle on={onlyProfitable} onClick={() => setOnlyProfitable((v) => !v)} title="Только прибыльные">
          <TrendingUp className="h-5 w-5" aria-hidden />
        </IconToggle>
        <IconToggle on={onlyAvailable} onClick={() => setOnlyAvailable((v) => !v)} title="Доступно сейчас">
          <span aria-hidden className="icon-mask icon-eft-crafting-available-now h-5 w-5" />
        </IconToggle>
        <IconToggle on={hideLocked} onClick={() => setHideLocked((v) => !v)} title="Скрыть заблокированные">
          <span aria-hidden className="icon-mask icon-eft-crafting-hide-locked h-5 w-5" />
        </IconToggle>
        <IconToggle on={emptyFuel} onClick={() => setEmptyFuel((v) => !v)} title="Пустой бак">
          <span aria-hidden className="icon-mask icon-eft-crafting-empty-tank h-5 w-5" />
        </IconToggle>
        {/* Сортировка. */}
        <SortDropdown sort={sort} onSort={setSort} />
      </div>

      {/* 2. Вкладки станций-модулей — под строкой контролов. */}
      <ModuleFilterTabs
        tabs={moduleTabs}
        topCount={topCount}
        active={activeStation}
        onSelect={setActiveStation}
      />

      {/* Закреплённые (скрепка) — всегда сверху, вне фильтров/вкладок. */}
      {pinnedCrafts.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-(--primary)">
            <span aria-hidden className="h-px w-6 bg-(--primary)/50" />
            Закреплённые · {pinnedCrafts.length}
          </span>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{pinnedCrafts.map(renderCard)}</div>
        </div>
      )}

      {/* 5. Грид карточек — 1/2/3 колонки (закреплённые исключены — они выше). */}
      {visible.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(renderCard)}</div>
      ) : (
        <p className="py-16 text-center text-sm text-text-muted font-blender-book">
          {pinnedCrafts.length > 0
            ? 'Остальные подходящие крафты закреплены выше.'
            : 'Ничего не найдено — измените фильтры.'}
        </p>
      )}
    </div>
  );
}

/** Read-only индикатор навыка: арт-иконка + крупный уровень + двухстрочная подпись (из Досье ЧВК). */
function SkillIndicator({ iconSrc, level, label }: { iconSrc: string; level: number; label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <img src={iconSrc} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-xs object-contain" />
      <span className="text-2xl leading-none tabular-nums text-(--primary) font-blender-medium">{level}</span>
      <span className="max-w-24 font-blender-medium text-type-micro uppercase leading-tight tracking-widest text-text-muted">
        {label}
      </span>
    </div>
  );
}

/** Иконка-тоггл фильтра (36×36, иконка 22px). Активна — рамка/фон primary; иначе — приглушённая. */
function IconToggle({
  on,
  onClick,
  title,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border transition-colors ${
        on
          ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)'
          : 'border-lines-hover bg-card-menu text-text-muted hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

/** Дропдаун сортировки: кнопка + поповер с 6 методами, закрытие по клику-вне и Esc. */
function SortDropdown({ sort, onSort }: { sort: CraftSortMode; onSort: (m: CraftSortMode) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
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
            const active = sort === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  onSort(o.key);
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
  );
}
