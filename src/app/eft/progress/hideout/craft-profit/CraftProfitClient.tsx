'use client';

// Клиент раздела «Прибыль убежища» (T7 craft-profit-rework): интро-блок + вкладки модулей +
// контролы + слайдеры навыков + грид карточек RecipeCard. Ридер (page.tsx) отдаёт СЫРЫЕ
// компоненты цены; всю экономику/фильтр/сортировку считаем реактивно через computeCraftEconomy
// (T2) в мемо-хелперах (§4.7 — не в JSX). Слайдеры навыков и «пустой бак» кормят те же формулы.
import { useEffect, useMemo, useState } from 'react';
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
import { CraftControls, type CraftSortMode } from '@/components/features/hideout/CraftControls';
import { ModuleFilterTabs, type ModuleTabDatum } from '@/components/features/hideout/ModuleFilterTabs';
import { SKILL_ICONS } from '@/components/features/adaptive/skill-icons';
import type { HideoutStationInfo } from '@/db/hideout';

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
const SKILL_MAX = 51; // 50 = максимум навыка, 51 — порог Elite-перка (клампится хелпером).

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

  // Дефолт слайдеров навыков = уровень из профиля (resolveSkillLevel). Инициализируем нулём,
  // после маунта подтягиваем профиль (persist доступен только на клиенте).
  const profileCrafting = mounted ? resolveSkillLevel(skillView, manualSkills, SKILL_CRAFTING) : 0;
  const profileHideoutMgmt = mounted ? resolveSkillLevel(skillView, manualSkills, SKILL_HIDEOUT_MGMT) : 0;

  const [craftingLevel, setCraftingLevel] = useState(0);
  const [hideoutMgmtLevel, setHideoutMgmtLevel] = useState(0);
  const [skillsTouched, setSkillsTouched] = useState(false);
  // Пока слайдеры не трогали руками — держим их синхронными с профилем (в т.ч. после его загрузки).
  useEffect(() => {
    if (skillsTouched) return;
    setCraftingLevel(profileCrafting);
    setHideoutMgmtLevel(profileHideoutMgmt);
  }, [profileCrafting, profileHideoutMgmt, skillsTouched]);

  const resetSkillsToProfile = () => {
    setSkillsTouched(false);
    setCraftingLevel(profileCrafting);
    setHideoutMgmtLevel(profileHideoutMgmt);
  };

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
      {/* Вкладки модулей. */}
      <ModuleFilterTabs
        tabs={moduleTabs}
        topCount={topCount}
        active={activeStation}
        onSelect={setActiveStation}
      />

      {/* 3. Контролы: поиск + фильтр-чипы + сортировка. */}
      <CraftControls
        search={search}
        onSearch={setSearch}
        onlyProfitable={onlyProfitable}
        onToggleProfitable={() => setOnlyProfitable((v) => !v)}
        onlyAvailable={onlyAvailable}
        onToggleAvailable={() => setOnlyAvailable((v) => !v)}
        hideLocked={hideLocked}
        onToggleHideLocked={() => setHideLocked((v) => !v)}
        sort={sort}
        onSort={setSort}
      />

      {/* 4. Слайдеры навыков + «пустой бак» + сброс к профилю. */}
      <div className="flex flex-col gap-3 rounded-md border border-lines-hover bg-card-menu/40 p-4 sm:flex-row sm:items-end sm:gap-6">
        <SkillSlider
          iconSrc={SKILL_ICONS.Crafting?.src ?? ''}
          label="Ручное производство"
          value={craftingLevel}
          onChange={(v) => {
            setSkillsTouched(true);
            setCraftingLevel(v);
          }}
        />
        <SkillSlider
          iconSrc={SKILL_ICONS.HideoutManagement?.src ?? ''}
          label="Управление убежищем"
          value={hideoutMgmtLevel}
          onChange={(v) => {
            setSkillsTouched(true);
            setHideoutMgmtLevel(v);
          }}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEmptyFuel((v) => !v)}
            aria-pressed={emptyFuel}
            className={`h-9 shrink-0 rounded-sm border px-3 font-blender-medium text-type-micro uppercase tracking-wider transition-colors ${
              emptyFuel
                ? 'border-(--primary) bg-(--primary)/15 text-(--primary)'
                : 'border-lines-hover text-text-muted hover:text-text-secondary'
            }`}
          >
            Пустой бак
          </button>
          <button
            type="button"
            onClick={resetSkillsToProfile}
            title="Вернуть уровни навыков к значениям из профиля"
            className="h-9 shrink-0 rounded-sm border border-lines-hover px-3 font-blender-medium text-type-micro uppercase tracking-wider text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Сбросить к профилю
          </button>
        </div>
      </div>

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

/** Слайдер уровня навыка 0–51 с иконкой, подписью и текущим значением. */
function SkillSlider({
  iconSrc,
  label,
  value,
  onChange,
}: {
  iconSrc: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-3">
      {/* Крупная иконка навыка слева, крутилка справа. */}
      <img src={iconSrc} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xs object-contain" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            {label}
          </span>
          <span className="shrink-0 font-blender-medium text-type-caption tabular-nums text-(--primary)">
            {value}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={SKILL_MAX}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-lines-hover accent-(--primary)"
        />
      </span>
    </label>
  );
}
