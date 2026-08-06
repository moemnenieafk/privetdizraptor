'use client';

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import type { TaskRaw, QuestNodeStatus, QuestBarterLite } from '@/types/quest';
import { computeStatusMap } from '@/lib/quest-status';
import { QuestNode } from '@/components/features/quests/QuestNode';
import { QuestResetModal } from '@/components/features/quests/QuestResetModal';
import { QuestDrawer } from '@/components/features/quests/QuestDrawer';
import { QuestTierToggles } from '@/components/features/quests/QuestTierToggles';
import { QuestTopBar } from '@/components/features/quests/QuestTopBar';
import { QuestSearchDrawer } from '@/components/features/quests/QuestSearchDrawer';
import { QuestLocationDock } from '@/components/features/quests/QuestLocationDock';
import { QuestActionsDock } from '@/components/features/quests/QuestActionsDock';
import { QuestStatusBar } from '@/components/features/quests/QuestStatusBar';
import { MobileQuestBar } from '@/components/features/quests/MobileQuestBar';
import { QuestSearchSheet } from '@/components/features/quests/QuestSearchSheet';
import { QuestTraderSheet } from '@/components/features/quests/QuestTraderSheet';
import { QuestMapsSheet } from '@/components/features/quests/QuestMapsSheet';
import { MAP_ICON_CSS as MAP_CSS } from '@/data/map-icons';
import { useQuestStore, exportProgress, importProgress } from '@/store/useQuestStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { TraderNode } from '@/components/features/quests/TraderNode';
import { TRADER_COLORS } from '@/data/traderColors';
import {
  QuestMapViewport,
  type QuestMapViewportRef,
  type ConnectionDef,
  type BackgroundRect,
  type Bounds,
} from '@/components/features/quests/QuestMapViewport';
import { traderImg } from '@/lib/trader-utils';
import { Paperclip } from 'lucide-react';
import PRESET_POSITIONS from '@/data/quests/quest-positions.json';

interface Props { initialTasks: TaskRaw[]; bartersByQuest?: Record<string, QuestBarterLite[]> }

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_W         = 348;
const NODE_H         = 90;
const TRADER_W       = 168;
const TRADER_H       = 196;
const QUEST_START_Y  = TRADER_H + 164;  // 360 — зазор портрет → первая полка (единый GAP)
const CELL_GAP       = 164;
const COLUMN_GAP     = 256;
const MAX_PER_ROW    = 15;
const LAST_QUEST_KEY = 'cta-last-quest-id';
const BASE_RE        = /-(day|night)$/i;

const TRADER_ORDER = [
  'prapor', 'therapist', 'skier', 'peacekeeper', 'mechanic',
  'jaeger', 'ragman', 'ref', 'fence', 'lightkeeper', 'btrdriver',
];
const OBJ_ROW_H         = 36;
// Базовая высота карточки: шапка + ряд «hero-баннер (81px) + название» + кнопка + прогресс-бар.
// Ряд с баннером фиксирован по высоте картинки, поэтому база выросла со 160 (было — только заголовок).
const CARD_BASE_H       = 206;
const CELL_W            = NODE_W + CELL_GAP;    // 512 — slot step (used in snap grid)
const ROW_STAGGER       = CELL_W / 2;                        // 256 — half-cell shift for odd rows (chess pattern)
const DRAG_POSITIONS_KEY = 'cta-quest-positions-ul'; // v2: старые (граф-цепочки) позиции инвалидированы

// ─── УЛ-полки (loyalty tiers) ────────────────────────────────────────────────
const TIER_HEADER_H = 56;           // высота заголовка полки (иконка УЛ + метка)
const TIER_TOP_GAP  = 96;           // отступ над полкой — место под пунктир-разделитель
const TIER_ROW_GAP  = 164;          // вертикальный зазор между рядами (= гориз. CELL_GAP)
const COL_PAD_L     = ROW_STAGGER;  // 256 — левый отступ контента (совпадает со снапом)
const TIER_PER_ROW  = 8;            // карточек в ряду полки

function getQuestNodeHeight(objCount: number): number {
  return CARD_BASE_H + Math.min(objCount, 5) * OBJ_ROW_H + (objCount > 5 ? 24 : 0);
}

// ─── Layout: УЛ-полки (loyalty tiers) ─────────────────────────────────────────

interface TierBand {
  key:     string;   // `${trader}-${tier}`
  trader:  string;
  tier:    number;   // 1..4
  x:       number;
  y:       number;
  width:   number;
  height:  number;
  count:   number;
  isFirst: boolean;  // первая полка колонки → без разделителя сверху
}

interface LayoutResult {
  layoutPositions:    Map<string, { x: number; y: number }>;
  traderOrder:        string[];
  traderColumnBounds: Map<string, Bounds>;
  graphBounds:        Bounds;
  nodeHeights:        Map<string, number>;
  tierBands:          TierBand[];
}

const clampTier = (n: number | undefined): number => Math.min(4, Math.max(1, n ?? 1));

// Раскладка «по уровню лояльности»: колонка на торговца, портрет сверху, ниже —
// полки УЛ1→УЛ4 (заголовок с иконкой УЛ + ряды квестов), между полками пунктир
// (рисуется в JSX из tierBands). Цепочек/связей больше нет — ось — уровень лояльности.
function computeLayout(tasks: TaskRaw[], measuredH: Map<string, number>): LayoutResult {
  const CELL_W   = NODE_W + CELL_GAP;                          // 512 — шаг по X (= сетке снапа)
  // Высота карточки: реальная (замер после рендера) → иначе оценка. Реальная критична:
  // оценка занижает до ~157px → ряды находят друг на дружку. Замер убирает наслоение.
  const heightOf = (t: TaskRaw): number => measuredH.get(t.id) ?? getQuestNodeHeight(t.objectives.length);
  const colWidth = COL_PAD_L + TIER_PER_ROW * CELL_W - CELL_GAP;

  const byTrader = new Map<string, TaskRaw[]>();
  for (const t of tasks) {
    const list = byTrader.get(t.trader.normalizedName) ?? [];
    list.push(t);
    byTrader.set(t.trader.normalizedName, list);
  }

  const traderOrder        = TRADER_ORDER.filter(n => byTrader.has(n));
  const positions          = new Map<string, { x: number; y: number }>();
  const nodeHeights        = new Map<string, number>();
  const traderColumnBounds = new Map<string, Bounds>();
  const tierBands: TierBand[] = [];

  let currentX = 0;
  for (const traderName of traderOrder) {
    const quests = byTrader.get(traderName)!;

    // Портрет — сверху-СЛЕВА, в одну вертикаль с заголовками полок и рядами (обозначение раздела).
    positions.set(`trader-${traderName}`, { x: currentX + COL_PAD_L, y: 0 });

    // Группировка квестов по УЛ.
    const byTier = new Map<number, TaskRaw[]>();
    for (const q of quests) {
      const ul = clampTier(q.ulTier);
      const g = byTier.get(ul) ?? [];
      g.push(q);
      byTier.set(ul, g);
    }
    const tiers = [...byTier.keys()].sort((a, b) => a - b);

    let y = QUEST_START_Y;
    let firstTier = true;
    for (const tier of tiers) {
      const group = [...byTier.get(tier)!].sort(
        (a, b) => (a.minPlayerLevel - b.minPlayerLevel) || a.name.localeCompare(b.name),
      );
      if (!firstTier) y += TIER_TOP_GAP;                 // место под пунктир-разделитель
      const bandTop = y;

      // Заголовок полки (иконка УЛ + метка) — слева, «на входе» ряда.
      positions.set(`tier-${traderName}-${tier}`, { x: currentX + COL_PAD_L, y });
      y += TIER_HEADER_H + 20;

      // Квесты полки — ряды по TIER_PER_ROW, высота ряда = макс. карточка ряда.
      for (let i = 0; i < group.length; i += TIER_PER_ROW) {
        const row = group.slice(i, i + TIER_PER_ROW);
        let rowMaxH = 0;
        for (let j = 0; j < row.length; j++) {
          const h = heightOf(row[j]);
          positions.set(row[j].id, { x: currentX + COL_PAD_L + j * CELL_W, y });
          nodeHeights.set(row[j].id, h);
          if (h > rowMaxH) rowMaxH = h;
        }
        y += rowMaxH + TIER_ROW_GAP;
      }

      tierBands.push({
        key: `${traderName}-${tier}`, trader: traderName, tier,
        x: currentX, y: bandTop, width: colWidth, height: y - bandTop,
        count: group.length, isFirst: firstTier,
      });
      firstTier = false;
    }

    traderColumnBounds.set(traderName, {
      minX: currentX - 20, minY: 0, maxX: currentX + colWidth + 20, maxY: y + 20,
    });
    currentX += colWidth + COLUMN_GAP;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [id, p] of positions) {
    const isT    = id.startsWith('trader-');
    const isTier = id.startsWith('tier-');
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + (isT ? TRADER_W : isTier ? 240 : NODE_W));
    maxY = Math.max(maxY, p.y + (isT ? TRADER_H : isTier ? TIER_HEADER_H : (nodeHeights.get(id) ?? NODE_H)));
  }

  return {
    layoutPositions:    positions,
    traderOrder,
    traderColumnBounds,
    nodeHeights,
    tierBands,
    graphBounds: {
      minX: isFinite(minX) ? minX : 0,
      minY: isFinite(minY) ? minY : 0,
      maxX: isFinite(maxX) ? maxX : 1000,
      maxY: isFinite(maxY) ? maxY : 800,
    },
  };
}

// ─── Diagonal connector ───────────────────────────────────────────────────────
// makeQuestPath вынесена в src/lib/quest-path.ts (общая для questmap и карт сюжетных историй).

// ─── Status ───────────────────────────────────────────────────────────────────
// computeStatusMap вынесена в src/lib/quest-status.ts (общая для карты и списков трейдеров).

// ─── Filter ───────────────────────────────────────────────────────────────────

function computeMinSubgraph(
  tasks: TaskRaw[],
  filterKappa: boolean,
  filterLK: boolean,
  ancestorMap: Map<string, Set<string>>,
): { filteredIds: Set<string>; subgraphTargetIds: Set<string> } {
  const subgraphTargetIds = new Set(
    tasks
      .filter(t => (filterKappa && t.kappaRequired) || (filterLK && t.lightkeeperRequired))
      .map(t => t.id)
  );
  const filteredIds = new Set<string>(subgraphTargetIds);
  for (const id of subgraphTargetIds)
    for (const anc of (ancestorMap.get(id) ?? new Set<string>())) filteredIds.add(anc);
  return { filteredIds, subgraphTargetIds };
}

function computeFilteredIds(
  tasks: TaskRaw[],
  filterKappa: boolean,
  filterLK: boolean,
  selectedTraders: Set<string>,
  selectedMaps: Set<string>,
  enabledTiers: Set<number>,
  ancestorMap: Map<string, Set<string>>,
): { filteredIds: Set<string> | null; subgraphTargetIds: Set<string> | null } {
  if (filterKappa || filterLK)
    return computeMinSubgraph(tasks, filterKappa, filterLK, ancestorMap);
  // Тир-тоглы (УЛ-полки) применяются всегда, кроме путь-режима каппы/смотрителя.
  const allTiers = enabledTiers.size >= 4;
  if (selectedTraders.size === 0 && selectedMaps.size === 0 && allTiers)
    return { filteredIds: null, subgraphTargetIds: null };
  return {
    filteredIds: new Set(
      tasks.filter(t => {
        if (selectedTraders.size > 0 && !selectedTraders.has(t.trader.normalizedName)) return false;
        if (!allTiers && !enabledTiers.has(Math.min(4, Math.max(1, t.ulTier ?? 1)))) return false;
        if (selectedMaps.size > 0) {
          const taskMaps = t.objectives
            .filter(o => o.__typename === 'TaskObjectiveBasic' && o.maps?.length)
            .flatMap(o => (o.maps ?? []).map(m => m.normalizedName.replace(BASE_RE, '')));
          // Строго: квест виден на локации, только если у него ЕСТЬ цель именно на ней.
          // Квесты без привязки к карте (сдать предмет и т.п.) под фильтром карты скрываем.
          if (!taskMaps.some(id => selectedMaps.has(id))) return false;
        }
        return true;
      }).map(t => t.id)
    ),
    subgraphTargetIds: null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuestMapClient({ initialTasks: rawTasks, bartersByQuest }: Props) {
  const searchParams = useSearchParams();

  // Story quests excluded; btr-driver normalizedName normalized to btrdriver
  const initialTasks = useMemo(
    () => rawTasks
      .filter(t => t.trader.normalizedName !== 'stories')
      .map(t => t.trader.normalizedName !== 'btr-driver' ? t : {
        ...t, trader: { ...t.trader, normalizedName: 'btrdriver' },
      }),
    [rawTasks],
  );

  const [selectedTask, setSelectedTask]       = useState<TaskRaw | null>(null);
  const [filterKappa, setFilterKappa]         = useState(false);
  const [filterLK, setFilterLK]               = useState(false);
  // Дефолт — ОДИН торговец (Прапор). Пустой набор = рендер всех 510 нод = лаг при отдалении,
  // поэтому на входе всегда одна колонка: ?trader= → торговец из ?quest= → первый (Прапор).
  const [selectedTraders, setSelectedTraders] = useState<Set<string>>(() => {
    const norm = (n: string | null) => (n === 'btr-driver' ? 'btrdriver' : n);
    const t = norm(searchParams.get('trader'));
    if (t) return new Set([t]);
    const q = searchParams.get('quest');
    if (q) {
      const task = initialTasks.find(x => x.id === q);
      if (task) return new Set([task.trader.normalizedName]);
    }
    return new Set([TRADER_ORDER[0]]);
  });
  const [selectedMaps, setSelectedMaps]       = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [freshlyUnlocked, setFreshlyUnlocked] = useState<Set<string>>(new Set());
  const [unlockedCount, setUnlockedCount]     = useState(0);
  const [searchOpen, setSearchOpen]           = useState(false);
  const [hoveredId, setHoveredId]             = useState<string | null>(null);
  const [isDragMode, setIsDragMode]           = useState(false);
  const [manualPositions, setManualPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [snapPreview, setSnapPreview]         = useState<{ id: string; x: number; y: number } | null>(null);
  const [selectedNodes, setSelectedNodes]     = useState<Set<string>>(new Set());
  const [groupPreview, setGroupPreview]       = useState<Map<string, { x: number; y: number }>>(new Map());
  const [measuredH, setMeasuredH]             = useState<Map<string, number>>(() => new Map());
  const [enabledTiers, setEnabledTiers]       = useState<Set<number>>(() => new Set([1, 2, 3, 4]));

  // near-fullscreen (как MapFrame): фрейм = 100svh − реальная высота хедера (ROW 1, крошки/поиск
  // на карт-роутах скрыты). ResizeObserver ловит адаптивный clamp-паддинг шапки на ресайзе.
  const [headerOffset, setHeaderOffset] = useState(88);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const measure = () => setHeaderOffset(header.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const vpRef           = useRef<QuestMapViewportRef | null>(null);
  const interactedRef   = useRef(false); // юзер уже выбрал торговца/квест — не перебивать mount-восстановлением
  const dragActiveRef   = useRef(false);
  const selectedNodesRef = useRef(selectedNodes);
  selectedNodesRef.current = selectedNodes;
  // Tracks latest snapPreview for onUp closure (avoids stale capture)
  const snapPreviewRef = useRef(snapPreview);
  snapPreviewRef.current = snapPreview;

  const [resetModalOpen, setResetModalOpen] = useState(false);

  const completedQuests = useQuestStore(s => s.completedQuests);
  const loadProgress    = useQuestStore(s => s.loadProgress);
  const pinnedQuests    = useQuestStore(s => s.pinnedQuests);
  const togglePin       = useQuestStore(s => s.togglePin);
  const setTasks        = useQuestStore(s => s.setTasks);
  const resetProgress   = useQuestStore(s => s.resetProgress);

  const profiles      = usePlayerStore(s => s.profiles);
  const activeId      = usePlayerStore(s => s.activeProfileId);
  const activeProfile = profiles.find(p => p.id === activeId);
  const playerLevel   = Number(activeProfile?.level ?? 1);
  const traderLevels  = activeProfile?.traderLevels ?? {};

  useEffect(() => { setTasks(initialTasks); }, [initialTasks, setTasks]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAG_POSITIONS_KEY);
      if (saved) setManualPositions(new Map(JSON.parse(saved)));
    } catch {}
  }, []);

  const playerLevelRef = useRef(playerLevel);
  playerLevelRef.current = playerLevel;

  // ── Graph maps ───────────────────────────────────────────────────────────
  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const task of initialTasks)
      for (const req of task.taskRequirements) {
        const arr = map.get(req.task.id) ?? [];
        arr.push(task.id);
        map.set(req.task.id, arr);
      }
    return map;
  }, [initialTasks]);

  const parentsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const task of initialTasks)
      for (const req of task.taskRequirements) {
        const arr = map.get(task.id) ?? [];
        arr.push(req.task.id);
        map.set(task.id, arr);
      }
    return map;
  }, [initialTasks]);

  const ancestorMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    function getAnc(id: string): Set<string> {
      if (map.has(id)) return map.get(id)!;
      const result = new Set<string>();
      const task   = initialTasks.find(t => t.id === id);
      if (!task) { map.set(id, result); return result; }
      for (const req of task.taskRequirements) {
        result.add(req.task.id);
        for (const a of getAnc(req.task.id)) result.add(a);
      }
      map.set(id, result);
      return result;
    }
    for (const t of initialTasks) getAnc(t.id);
    return map;
  }, [initialTasks]);

  const descendantMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    function getDesc(id: string): Set<string> {
      if (map.has(id)) return map.get(id)!;
      const result = new Set<string>();
      for (const childId of (childrenMap.get(id) ?? [])) {
        result.add(childId);
        for (const d of getDesc(childId)) result.add(d);
      }
      map.set(id, result);
      return result;
    }
    for (const t of initialTasks) getDesc(t.id);
    return map;
  }, [initialTasks, childrenMap]);

  // ── Maps dedup ───────────────────────────────────────────────────────────
  const maps = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; normalizedName: string }>();
    for (const task of initialTasks)
      for (const obj of task.objectives)
        if (obj.__typename === 'TaskObjectiveBasic' && obj.maps?.length)
          for (const m of obj.maps) {
            const baseKey = m.normalizedName.replace(BASE_RE, '');
            if (!seen.has(baseKey))
              seen.set(baseKey, {
                id: baseKey,
                name: m.name.replace(/ (Day|Night|Ночь|День)$/i, '').trim(),
                normalizedName: baseKey,
              });
          }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [initialTasks]);

  // ── Layout ───────────────────────────────────────────────────────────────
  const {
    layoutPositions,
    traderOrder,
    traderColumnBounds,
    graphBounds,
    nodeHeights,
    tierBands,
  } = useMemo(() => computeLayout(initialTasks, measuredH), [initialTasks, measuredH]);

  const layoutPositionsRef     = useRef(layoutPositions);
  layoutPositionsRef.current   = layoutPositions;
  const graphBoundsRef         = useRef(graphBounds);
  graphBoundsRef.current       = graphBounds;
  const traderColumnBoundsRef  = useRef(traderColumnBounds);
  traderColumnBoundsRef.current = traderColumnBounds;
  const traderOrderRef         = useRef(traderOrder);
  traderOrderRef.current       = traderOrder;
  const nodeHeightsRef         = useRef(nodeHeights);
  nodeHeightsRef.current       = nodeHeights;

  // ── Effective positions: algorithm → preset → user drag (localStorage) ──────
  const connPositions = useMemo(() => {
    const m = new Map(layoutPositions);
    for (const [id, p] of Object.entries(PRESET_POSITIONS)) m.set(id, p as { x: number; y: number });
    for (const [id, p] of manualPositions) m.set(id, p);
    return m;
  }, [layoutPositions, manualPositions]);

  const connPositionsRef = useRef(connPositions);
  connPositionsRef.current = connPositions;


  // ── Status + filter ──────────────────────────────────────────────────────
  const statusMap = useMemo(
    () => computeStatusMap(initialTasks, new Set(completedQuests), playerLevel),
    [completedQuests, playerLevel, initialTasks],
  );

  // Реальные высоты карточек: расчёт занижает (переносы заголовка, бейджи, статус-кнопка)
  // → меряем offsetHeight после рендера и переукладываем от факта, чтобы ряды НЕ находили
  // друг на дружку. Функц. setState со сверкой размеров → без бесконечного перерендера.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-qid]');
    if (els.length === 0) return;
    const next = new Map<string, number>();
    els.forEach((el) => {
      const id = el.dataset.qid;
      if (id && el.offsetHeight > 0) next.set(id, el.offsetHeight);
    });
    // Аккумулируем: замеренная высота ноды кэшируется, даже когда её колонку скрыл куллинг,
    // поэтому возврат к торговцу не даёт вспышки-наслоения (высоты уже известны).
    setMeasuredH((prev) => {
      let changed = false;
      const merged = new Map(prev);
      for (const [id, h] of next) if (prev.get(id) !== h) { merged.set(id, h); changed = true; }
      return changed ? merged : prev;
    });
    // selectedTraders/selectedMaps/filter* меняют набор смонтированных нод (куллинг),
    // isDragMode тоже (в ПРАВКЕ монтируются все) → пере-замер обязателен.
  }, [initialTasks, statusMap, selectedTraders, selectedMaps, filterKappa, filterLK, enabledTiers, isDragMode]);

  const { filteredIds, subgraphTargetIds } = useMemo(
    () => computeFilteredIds(initialTasks, filterKappa, filterLK, selectedTraders, selectedMaps, enabledTiers, ancestorMap),
    [initialTasks, filterKappa, filterLK, selectedTraders, selectedMaps, enabledTiers, ancestorMap],
  );

  // ── Chain highlight ──────────────────────────────────────────────────────
  const chainSet = useMemo<Set<string> | null>(() => {
    if (!hoveredId) return null;
    const anc  = ancestorMap.get(hoveredId)   ?? new Set<string>();
    const desc = descendantMap.get(hoveredId) ?? new Set<string>();
    return new Set([...anc, hoveredId, ...desc]);
  }, [hoveredId, ancestorMap, descendantMap]);

  const getChainRole = useCallback((id: string): 'ancestor' | 'descendant' | 'self' | null | undefined => {
    if (!chainSet) return undefined;
    if (id === hoveredId)                       return 'self';
    if (ancestorMap.get(hoveredId!)?.has(id))   return 'ancestor';
    if (descendantMap.get(hoveredId!)?.has(id)) return 'descendant';
    return null;
  }, [chainSet, hoveredId, ancestorMap, descendantMap]);

  // Связей/зависимостей больше нет — questmap группирует квесты по УЛ (loyalty tiers).
  const staticConnections = useMemo<ConnectionDef[]>(() => [], []);

  const columnBackgrounds = useMemo<BackgroundRect[]>(() => [], []);

  const tradersInFilter = useMemo(
    () => filteredIds === null
      ? null
      : new Set(initialTasks.filter(t => filteredIds.has(t.id)).map(t => t.trader.normalizedName)),
    [filteredIds, initialTasks],
  );

  // «Все» (пустой набор торговцев) без активного фильтра → гейт: квесты НЕ рендерим,
  // показываем подсказку — иначе вернётся лаг от 510 нод (см. спеку, вопрос 4).
  const isGate = selectedTraders.size === 0 && selectedMaps.size === 0
    && !filterKappa && !filterLK && enabledTiers.size >= 4;
  const selectedTrader = selectedTraders.size === 1 ? [...selectedTraders][0] : null;

  const pinnedSet = useMemo(() => new Set(pinnedQuests), [pinnedQuests]);

  // Зум, при котором объект шириной w влезает в экран целиком (с полями).
  // Ограничен сверху desired — на десктопе поведение прежнее, на узком экране ужимается.
  const fitZoom = useCallback((w: number, desired = 1.2) => {
    if (typeof window === 'undefined') return desired;
    const avail = window.innerWidth * 0.88; // 12% суммарно на поля
    return Math.max(0.4, Math.min(desired, avail / w));
  }, []);

  // ── Navigate to a quest ──────────────────────────────────────────────────
  const flyToQuest = useCallback((id: string, zoom = 1.2, duration = 0) => {
    const pos = connPositionsRef.current.get(id);
    // Потолок зума — чтобы карточка ноды влезала в экран целиком (на мобилке ужимается).
    const z = fitZoom(NODE_W, zoom);
    if (pos) vpRef.current?.setCenter(pos.x + NODE_W / 2, pos.y + NODE_H / 2, { zoom: z, duration });
  }, [fitZoom]);

  // ── Initial view on mount ────────────────────────────────────────────────
  useEffect(() => {
    let raf1 = 0, raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const vp = vpRef.current;
        if (!vp) return;
        // Если пользователь уже выбрал торговца/квест (клик обогнал поздний rAF при медленной
        // компиляции) — не перебиваем его восстановлением последнего квеста.
        if (interactedRef.current) return;

        // Deep-link из глобального поиска: плавный полёт к конкретному квесту (?quest=<id>)
        const focusId = searchParams.get('quest');
        if (focusId && connPositionsRef.current.has(focusId)) {
          flyToQuest(focusId, 1.4, 600);
          return;
        }

        // Явный ?trader= — приземление на верх его колонки (торговец уже выбран инициализатором).
        const urlTrader = ((n: string | null) => (n === 'btr-driver' ? 'btrdriver' : n))(searchParams.get('trader'));
        if (urlTrader && traderColumnBoundsRef.current.has(urlTrader)) {
          fitTraderColumn(urlTrader, 0);
          return;
        }

        // Restore last visited quest (+ показать его колонку, иначе куллинг скроет восстановленную ноду).
        const lastId = localStorage.getItem(LAST_QUEST_KEY);
        if (lastId && connPositionsRef.current.has(lastId)) {
          const task = initialTasks.find(x => x.id === lastId);
          if (task) setSelectedTraders(new Set([task.trader.normalizedName]));
          flyToQuest(lastId, 1.2, 0);
          return;
        }

        // Дефолт: верх колонки первого торговца (Прапор). Колонка, а не весь граф — иначе
        // при гонке (позиции не готовы) получался пустой fit всего графа на ZOOM_MIN.
        const firstTrader = traderOrderRef.current[0];
        if (firstTrader && traderColumnBoundsRef.current.has(firstTrader)) {
          fitTraderColumn(firstTrader, 0);
          return;
        }

        // Крайний фолбэк: фит всего графа.
        vp.fitToBounds(graphBoundsRef.current, { padding: 0.08, duration: 0 });
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fullscreen ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFullscreen) {
      document.body.setAttribute('data-quest-fullscreen', '');
      requestAnimationFrame(() =>
        vpRef.current?.fitToBounds(graphBoundsRef.current, { padding: 0.06, duration: 400 }),
      );
    } else {
      document.body.removeAttribute('data-quest-fullscreen');
    }
    return () => document.body.removeAttribute('data-quest-fullscreen');
  }, [isFullscreen]);

  // Пока открыт боковой drawer квеста — прячем плавающий «Завоз». Он живёт в корневом
  // fixed-контексте (z-40 в layout), а drawer заперт в контексте наложения страницы,
  // поэтому z-index'ом его не перекрыть. Сигнал — body-атрибут, как у фуллскрина.
  useEffect(() => {
    if (selectedTask) document.body.setAttribute('data-quest-drawer', '');
    else document.body.removeAttribute('data-quest-drawer');
    return () => document.body.removeAttribute('data-quest-drawer');
  }, [selectedTask]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen)   { setSearchOpen(false); return; }
        if (isFullscreen)   setIsFullscreen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setSearchOpen(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, searchOpen]);

  // ── Kappa stats ──────────────────────────────────────────────────────────
  const { kappaTotal, kappaCompleted, lkTotal, lkCompleted } = useMemo(() => {
    const completedSet = new Set(completedQuests);
    return {
      kappaTotal:     initialTasks.filter(t => t.kappaRequired).length,
      kappaCompleted: initialTasks.filter(t => t.kappaRequired && completedSet.has(t.id)).length,
      lkTotal:        initialTasks.filter(t => t.lightkeeperRequired).length,
      lkCompleted:    initialTasks.filter(t => t.lightkeeperRequired && completedSet.has(t.id)).length,
    };
  }, [initialTasks, completedQuests]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const hoveredRafRef    = useRef<number>(0);
  const pendingHoverRef  = useRef<string | null>(null);
  const handleHover = useCallback((id: string | null) => {
    if (dragActiveRef.current) return;
    pendingHoverRef.current = id;
    cancelAnimationFrame(hoveredRafRef.current);
    hoveredRafRef.current = requestAnimationFrame(() => setHoveredId(pendingHoverRef.current));
  }, []);

  const handleForceComplete = useCallback((taskId: string) => {
    const { completedQuests: nowCompleted, toggleQuest } = useQuestStore.getState();
    const ancestors = ancestorMap.get(taskId) ?? new Set<string>();
    for (const ancestorId of ancestors) {
      if (!nowCompleted.includes(ancestorId)) {
        toggleQuest(ancestorId);
      }
    }
    if (!nowCompleted.includes(taskId)) {
      toggleQuest(taskId);
    }
  }, [ancestorMap]);

  const handleToggle = useCallback((taskId: string) => {
    const { completedQuests: nowCompleted, toggleQuest } = useQuestStore.getState();
    const wasCompleted = nowCompleted.includes(taskId);
    toggleQuest(taskId);
    localStorage.setItem(LAST_QUEST_KEY, taskId);

    if (!wasCompleted) {
      const candidateIds = childrenMap.get(taskId) ?? [];
      const newCompleted = new Set([...nowCompleted, taskId]);
      const completedTask = initialTasks.find(t => t.id === taskId);
      const newlyActive = candidateIds.filter(childId => {
        const childTask = initialTasks.find(t => t.id === childId);
        if (!childTask) return false;
        return (
          childTask.taskRequirements.every(r => newCompleted.has(r.task.id)) &&
          playerLevelRef.current >= childTask.minPlayerLevel
        );
      });
      if (newlyActive.length > 0) {
        setFreshlyUnlocked(new Set(newlyActive));
        setTimeout(() => setFreshlyUnlocked(new Set()), 4000);
        const sameTrader = completedTask?.trader.normalizedName;
        const jumpTarget = newlyActive.find(
          id => initialTasks.find(t => t.id === id)?.trader.normalizedName === sameTrader,
        );
        if (jumpTarget) flyToQuest(jumpTarget, 1.4, 700);
        if (newlyActive.length > 1) {
          setUnlockedCount(newlyActive.length);
          setTimeout(() => setUnlockedCount(0), 4000);
        }
      }
    }
  }, [childrenMap, initialTasks, togglePin, flyToQuest]);

  const handleExport = useCallback(() => {
    const { completedQuests: cq, itemProgress: ip } = useQuestStore.getState();
    const json = exportProgress(cq, ip);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cta-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback((file: File) => {
    if (!window.confirm('Заменить текущий прогресс данными из файла?')) return;
    const reader  = new FileReader();
    reader.onload = e => {
      const result = importProgress(e.target?.result as string);
      if (result) loadProgress(result.completedQuests, result.itemProgress);
    };
    reader.readAsText(file);
  }, [loadProgress]);

  const handleMap = (id: string) =>
    setSelectedMaps(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Дропдаун карты заданий: выбрать торговца (single-select + перелёт) или «Все» (name=null →
  // пустой набор = кросс-трейдер режим).
  // Приземление на ВЕРХ колонки торговца (портрет + первые полки). На near-fullscreen центр
  // портрета оставлял пол-экрана пустым сверху; fitToBounds верх-региона надёжен (bounds колонки
  // всегда посчитаны в computeLayout, не зависят от готовности портрет-ноды).
  const fitTraderColumn = useCallback((name: string, duration = 500) => {
    const b = traderColumnBoundsRef.current.get(name);
    if (b) vpRef.current?.fitToBounds(
      { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: Math.min(b.maxY, b.minY + 1400) },
      { padding: 0.05, duration },
    );
  }, []);

  const handleSelectTrader = useCallback((name: string | null) => {
    interactedRef.current = true;
    if (name === null) { setSelectedTraders(new Set()); return; }
    setSelectedTraders(new Set([name]));
    fitTraderColumn(name);
  }, [fitTraderColumn]);

  // Клик по результату левого поиска (глобального): сменить торговца на канвасе → перелёт к
  // квесту → открыть правый дровер деталей. На узком экране (<1440) закрываем поиск (правило шелла Карт).
  const handleSearchResult = useCallback((task: TaskRaw) => {
    interactedRef.current = true;
    setSelectedTraders(new Set([task.trader.normalizedName]));
    flyToQuest(task.id, 1.4, 500);
    setSelectedTask(task);
    if (typeof window !== 'undefined' && window.innerWidth < 1440) setSearchOpen(false);
  }, [flyToQuest]);

  // Мобилка: перелёт к портрету торговца без изменения фильтра (фильтрация по торговцам на телефоне убрана).
  const handleFocusTrader = useCallback((name: string) => {
    const pos = connPositionsRef.current.get(`trader-${name}`);
    if (pos) vpRef.current?.setCenter(pos.x + TRADER_W / 2, pos.y + TRADER_H / 2, { zoom: fitZoom(TRADER_W), duration: 500 });
  }, [fitZoom]);

  // Список торговцев для мобильного шита (в порядке TRADER_ORDER).
  const mobileTraders = useMemo(() => {
    const seen = new Map<string, { normalizedName: string; name: string }>();
    for (const t of initialTasks) {
      if (!seen.has(t.trader.normalizedName)) {
        seen.set(t.trader.normalizedName, { normalizedName: t.trader.normalizedName, name: t.trader.name });
      }
    }
    return TRADER_ORDER.filter(n => seen.has(n)).map(n => seen.get(n)!);
  }, [initialTasks]);

  // Карты для мобильного шита. Ночные варианты и 21+ отсеиваем — одна иконка на локацию
  // подхватывает и день, и ночь (как в десктопном QuestFilterBar).
  const mobileMaps = useMemo(
    () => maps
      .filter(m => !m.normalizedName.includes('night') && !m.name.includes('21+'))
      .map(m => ({ id: m.id, name: m.name, iconClass: MAP_CSS[m.normalizedName] ?? null })),
    [maps],
  );

  // УЛ-тоглы: тоггл видимости полки лояльности; последний выключить нельзя (иначе пустой канвас).
  const handleToggleTier = useCallback((tier: number) => {
    setEnabledTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) {
        if (next.size <= 1) return prev;
        next.delete(tier);
      } else next.add(tier);
      return next;
    });
  }, []);

  const handleFocusNode = useCallback((task: TaskRaw) => { flyToQuest(task.id, 1.5, 500); }, [flyToQuest]);

  // ── Fly to next active quest in Kappa / LK path ──────────────────────────
  const flyToNextInPath = useCallback((type: 'kappa' | 'lk') => {
    const candidates = initialTasks.filter(t => {
      const inPath = type === 'kappa' ? t.kappaRequired : t.lightkeeperRequired;
      return inPath && statusMap.get(t.id)?.status === 'active';
    });
    if (candidates.length === 0) return;
    // Shallowest in the dependency tree = fewest ancestors = first step toward Kappa/LK
    const target = candidates.reduce((best, t) => {
      const da = ancestorMap.get(t.id)?.size ?? 0;
      const db = ancestorMap.get(best.id)?.size ?? 0;
      return da < db || (da === db && t.name < best.name) ? t : best;
    });
    flyToQuest(target.id, 1.4, 700);
  }, [initialTasks, statusMap, ancestorMap, flyToQuest]);

  const handleKappaClick = useCallback(() => {
    setFilterKappa(v => !v);
    flyToNextInPath('kappa');
  }, [flyToNextInPath]);

  const handleLKClick = useCallback(() => {
    setFilterLK(v => !v);
    flyToNextInPath('lk');
  }, [flyToNextInPath]);

  // ── Snap: nearest column slot X; Y остаётся свободным ────────────────────
  // nodeWidth: width of element being snapped (NODE_W for quests, TRADER_W for portraits).
  //   Center of element aligns with center of nearest quest slot (гориз. зазор = CELL_GAP 164).
  // Вертикаль магнитит edge-snap к соседям с зазором 164 (высоты карточек переменные,
  // поэтому фиксированной Y-сетки нет — иначе карточки не выровнялись бы под замер-раскладку).
  const snapPosition = useCallback((
    rawX: number, rawY: number,
    nodeWidth = NODE_W,
  ): { x: number; y: number } => {
    const rawCenterX = rawX + nodeWidth / 2;
    let bestX    = rawX;
    let bestDist = Infinity;
    for (const name of traderOrderRef.current) {
      const b = traderColumnBoundsRef.current.get(name);
      if (!b) continue;
      const colStart    = b.minX + 20 + ROW_STAGGER;
      const relX        = rawCenterX - colStart;
      const slotI       = Math.max(0, Math.min(MAX_PER_ROW - 1, Math.round(relX / CELL_W)));
      const slotCenterX = colStart + slotI * CELL_W + NODE_W / 2;
      const dist        = Math.abs(rawCenterX - slotCenterX);
      if (dist < bestDist) { bestDist = dist; bestX = slotCenterX - nodeWidth / 2; }
    }
    return { x: bestX, y: rawY };
  }, []);

  // ── Drag-mode: pointer capture per node ──────────────────────────────────
  const handleNodeDragStart = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    taskId: string,
  ) => {
    if (!isDragMode) return;
    e.stopPropagation();

    // Shift+click → toggle selection, no drag
    if (e.shiftKey) {
      setSelectedNodes(prev => {
        const next = new Set(prev);
        if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
        return next;
      });
      return;
    }

    const startPos = connPositionsRef.current.get(taskId);
    if (!startPos) return;

    const isTrader = taskId.startsWith('trader-');

    // Group drag when anchor is part of a multi-selection
    const isGroup = !isTrader && selectedNodesRef.current.has(taskId) && selectedNodesRef.current.size > 1;
    type GroupEntry = { id: string; pos: { x: number; y: number } };
    const groupPeers: GroupEntry[] = isGroup
      ? [...selectedNodesRef.current]
          .filter(id => id !== taskId)
          .flatMap(id => {
            const pos = connPositionsRef.current.get(id);
            return pos ? [{ id, pos }] : [];
          })
      : [];

    // Single drag clears selection
    if (!isGroup) setSelectedNodes(new Set());

    dragActiveRef.current = true;
    const canvasStart = vpRef.current?.screenToCanvas(e.clientX, e.clientY) ?? { x: 0, y: 0 };
    const startX      = startPos.x;
    const startY      = startPos.y;
    let   lastSnapped = { x: startX, y: startY };
    let   hasMoved    = false;

    function onMove(ev: PointerEvent) {
      hasMoved = true;
      const c   = vpRef.current?.screenToCanvas(ev.clientX, ev.clientY) ?? { x: 0, y: 0 };
      const rawX = startX + (c.x - canvasStart.x);
      const rawY = startY + (c.y - canvasStart.y);

      // Primary snap: X к сетке колонок (гориз. зазор 164), Y свободный.
      let { x: snX, y: snY } = snapPosition(rawX, rawY, isTrader ? TRADER_W : NODE_W);

      // Secondary edge-snap: примагнитить к соседям по колонке с зазором ровно 164px.
      //   X — к колонке соседа (±1 слот); Y — верх карточки под низ соседа (+164)
      //   либо низ над верхом соседа (−164), в зависимости от близости.
      if (!isTrader) {
        const X_SNAP = 90;                 // px — радиус примагничивания по X (колонка)
        const Y_SNAP = 130;                // px — радиус примагничивания по Y (зазор к соседу)
        const dh     = nodeHeightsRef.current.get(taskId) ?? NODE_H;
        let bestXDist = Math.abs(rawX - snX);
        let bestYDist = Y_SNAP;            // Y магнитится, только если сосед в пределах радиуса
        for (const [id, existPos] of connPositionsRef.current) {
          if (id === taskId || id.startsWith('trader-') || id.startsWith('tier-')) continue;
          // X: колонка соседа и ±1 слот (сохраняет 164 по горизонтали).
          for (const cx of [existPos.x, existPos.x - CELL_W, existPos.x + CELL_W]) {
            const d = Math.abs(rawX - cx);
            if (d < X_SNAP && d < bestXDist) { bestXDist = d; snX = cx; }
          }
          // Y: зазор 164 только к соседям той же колонки (иначе выравнивание бессмысленно).
          if (Math.abs(rawX - existPos.x) < X_SNAP) {
            const nh = nodeHeightsRef.current.get(id) ?? NODE_H;
            for (const cy of [existPos.y + nh + CELL_GAP, existPos.y - dh - CELL_GAP]) {
              const d = Math.abs(rawY - cy);
              if (d < bestYDist) { bestYDist = d; snY = cy; }
            }
          }
        }
        snY = Math.max(QUEST_START_Y, snY);   // не заезжать под портрет
      }

      lastSnapped = { x: snX, y: snY };
      setSnapPreview({ id: taskId, ...lastSnapped });

      if (isGroup) {
        const dx = lastSnapped.x - startX;
        const dy = lastSnapped.y - startY;
        setGroupPreview(new Map(groupPeers.map(g => [g.id, { x: g.pos.x + dx, y: g.pos.y + dy }])));
      }
    }

    function onUp() {
      dragActiveRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
      setSnapPreview(null);
      if (isGroup) setGroupPreview(new Map());
      if (hasMoved) {
        setManualPositions(prev => {
          const next = new Map(prev);
          next.set(taskId, lastSnapped);
          if (isGroup) {
            const dx = lastSnapped.x - startX;
            const dy = lastSnapped.y - startY;
            for (const g of groupPeers) {
              next.set(g.id, { x: g.pos.x + dx, y: g.pos.y + dy });
            }
          }
          try { localStorage.setItem(DRAG_POSITIONS_KEY, JSON.stringify([...next])); } catch {}
          return next;
        });
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    setSnapPreview({ id: taskId, x: startX, y: startY });
  }, [isDragMode, snapPosition]);

  // ── Box select: hit-test all quest nodes against canvas rect ─────────────
  const handleBoxSelect = useCallback((cx0: number, cy0: number, cx1: number, cy1: number) => {
    const minX = Math.min(cx0, cx1);
    const maxX = Math.max(cx0, cx1);
    const minY = Math.min(cy0, cy1);
    const maxY = Math.max(cy0, cy1);
    // Tiny rect (click) → clear selection
    if (maxX - minX < 5 && maxY - minY < 5) {
      setSelectedNodes(new Set());
      return;
    }
    const next = new Set<string>();
    for (const task of initialTasks) {
      const pos = connPositionsRef.current.get(task.id);
      if (!pos) continue;
      if (pos.x < maxX && pos.x + NODE_W > minX && pos.y < maxY && pos.y + NODE_H > minY) {
        next.add(task.id);
      }
    }
    setSelectedNodes(next);
  }, [initialTasks]);

  // Фрейм: на мобилке тянется по вьюпорту (как MapFrame карт локаций), на десктопе — эталон 1100×768.
  // z-[200] в фуллскрине перекрывает бургер-меню (у него бэкдроп z-100).
  // near-fullscreen как MapFrame: edge-to-edge под шапкой, без bounded-box/паддингов/рамки.
  // Высота — definite (100svh − высота ROW 1), фрейм = ровно остаток вьюпорта → страница не скроллится.
  const containerCls   = isFullscreen
    ? 'fixed inset-0 z-[200] flex flex-col bg-(--color-base) overflow-hidden'
    : 'relative flex w-full flex-col overflow-hidden bg-(--color-base)';
  const containerStyle = isFullscreen ? undefined : { height: `calc(100svh - ${headerOffset}px)` };

  return (
    <>
      <div className={containerCls} style={containerStyle}>
        {/* Мобильная верхняя панель: поиск / торговцы / карты */}
        <MobileQuestBar mapsFilterActive={selectedMaps.size > 0} />

        {/* Десктопный топбар — плавающий прозрачный оверлей поверх канваса (как MapTopBar карт локаций) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden lg:block">
        <QuestTopBar
          searchOpen={searchOpen}
          onSearchOpen={() => setSearchOpen(v => !v)}
          kappaTotal={kappaTotal}
          kappaCompleted={kappaCompleted}
          lkTotal={lkTotal}
          lkCompleted={lkCompleted}
          filterKappa={filterKappa}
          filterLK={filterLK}
          onKappa={handleKappaClick}
          onLK={handleLKClick}
          traders={mobileTraders}
          traderLevels={traderLevels}
          selectedTrader={selectedTrader}
          onSelectTrader={handleSelectTrader}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(v => !v)}
          isDragMode={isDragMode}
          onToggleDrag={() => { setIsDragMode(v => !v); setSnapPreview(null); setSelectedNodes(new Set()); setGroupPreview(new Map()); }}
        />
        </div>

        {/* Мобильные шиты */}
        <QuestSearchSheet tasks={initialTasks} onFocus={handleFocusNode} />
        <QuestTraderSheet traders={mobileTraders} onFocusTrader={handleFocusTrader} />
        <QuestMapsSheet
          maps={mobileMaps}
          selectedMaps={selectedMaps}
          onToggleMap={handleMap}
          onReset={() => setSelectedMaps(new Set())}
        />

        <div className="flex flex-1 min-h-0">

          <div className="relative flex-1 min-w-0">
            {/* УЛ-тоглы — плавающая полоса ПОД плавающим топбаром, по центру (десктоп). */}
            <div className="pointer-events-none absolute inset-x-0 top-16 z-20 hidden justify-center lg:flex">
              <div className="pointer-events-auto">
                <QuestTierToggles enabled={enabledTiers} onToggle={handleToggleTier} />
              </div>
            </div>

            {/* Гейт «Все без фильтра»: не рендерим 510 нод, зовём выбрать путь/фильтр. */}
            {isGate && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
                <div className="pointer-events-auto max-w-md rounded-lg border border-lines-hover bg-(--color-base)/80 px-8 py-6 text-center backdrop-blur-md">
                  <p className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">Выбери путь или фильтр</p>
                  <p className="mt-2 font-blender-book text-sm leading-relaxed text-text-muted">
                    Режим «Все» показывает квесты по фильтру — путь Каппы или Смотрителя, поиск по заданию либо локация. Или выбери торговца, чтобы увидеть его ветку.
                  </p>
                </div>
              </div>
            )}
            <QuestMapViewport
              ref={vpRef}
              connections={staticConnections}
              backgroundRects={columnBackgrounds}
              chainSet={chainSet}
              className="absolute inset-0"
              isDragMode={isDragMode}
              onBoxSelect={handleBoxSelect}
            >
            {/* УЛ-полки: заголовок (иконка УЛ + метка) + пунктир-разделитель между полками */}
            {tierBands.map(band => {
              // Куллинг УЛ-меток и пунктиров: в обычном режиме рисуем только у видимых торговцев
              // и только для включённых УЛ-тоглов; чужие/выключенные полки не висят в пустоте. В ПРАВКЕ — все.
              if (!isDragMode && (isGate || (tradersInFilter !== null && !tradersInFilter.has(band.trader)) || !enabledTiers.has(band.tier))) return null;
              const pos = connPositions.get(`tier-${band.trader}-${band.tier}`);
              if (!pos) return null;
              return (
                <Fragment key={band.key}>
                  {!band.isFirst && (
                    <div
                      style={{
                        position:  'absolute',
                        left:      band.x + COL_PAD_L,
                        top:       band.y - TIER_TOP_GAP / 2,
                        width:     band.width - COL_PAD_L - 40,
                        height:    0,
                        borderTop: '3px dashed var(--color-lines-hover)',
                        opacity:   0.6,
                      }}
                    />
                  )}
                  <div
                    style={{ position: 'absolute', left: pos.x, top: pos.y }}
                    className="flex items-center gap-3 whitespace-nowrap select-none pointer-events-none"
                  >
                    <span className={`icon-mask icon-eft-profile-rep-${band.tier} h-12 w-12 shrink-0 text-(--primary)`} />
                    <span className="text-3xl font-blender-medium uppercase tracking-widest leading-none text-(--primary)">
                      Уровень лояльности {band.tier}
                    </span>
                    <span className="text-xl font-blender-medium leading-none text-text-muted">· {band.count}</span>
                  </div>
                </Fragment>
              );
            })}

            {/* Trader portraits */}
            {traderOrder.map(traderName => {
              // Куллинг портрета-заголовка: в обычном режиме рисуем колонки только видимых торговцев.
              if (!isDragMode && tradersInFilter !== null && !tradersInFilter.has(traderName)) return null;
              const nodeId     = `trader-${traderName}`;
              const basePos    = connPositions.get(nodeId);
              const previewPos = snapPreview?.id === nodeId ? snapPreview : undefined;
              const pos        = previewPos ?? basePos;
              const srcTask    = initialTasks.find(t => t.trader.normalizedName === traderName);
              if (!pos || !srcTask) return null;
              const isDragging = !!previewPos;
              return (
                <div
                  key={nodeId}
                  style={{
                    position: 'absolute',
                    left:     pos.x,
                    top:      pos.y,
                    opacity:  isDragging ? 0.72 : undefined,
                    zIndex:   isDragging ? 200  : undefined,
                  }}
                  data-no-pan
                  className={isDragMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : undefined}
                  onPointerDown={isDragMode ? (e) => handleNodeDragStart(e, nodeId) : undefined}
                >
                  <TraderNode data={{
                    traderName:     srcTask.trader.name,
                    normalizedName: traderName,
                    color:          TRADER_COLORS[traderName] ?? '#555555',
                    dimmed:         isDragMode && tradersInFilter !== null && !tradersInFilter.has(traderName),
                  }} />
                </div>
              );
            })}

            {/* Quest nodes */}
            {initialTasks.map(task => {
              // Куллинг: в обычном режиме рисуем ТОЛЬКО видимые ноды (выбранный торговец + фильтры),
              // остальные unmount — иначе все 510 карточек висят в DOM и лагают при отдалении.
              // В ПРАВКЕ (drag) показываем все, чтобы расставлять. filteredIds===null → «показать все».
              if (!isDragMode && (isGate || (filteredIds !== null && !filteredIds.has(task.id)))) return null;
              const basePos    = connPositions.get(task.id);
              const anchorPrev = snapPreview?.id === task.id ? snapPreview : undefined;
              const groupPrev  = groupPreview.get(task.id);
              const previewPos = anchorPrev ?? groupPrev;
              const pos        = previewPos ?? basePos;
              if (!pos) return null;
              const isDragging = !!previewPos;
              const isSelected = isDragMode && selectedNodes.has(task.id);
              const entry      = statusMap.get(task.id) ?? { status: 'locked' as QuestNodeStatus };
              return (
                <div
                  key={task.id}
                  data-qid={task.id}
                  style={{
                    position:      'absolute',
                    left:          pos.x,
                    top:           pos.y,
                    opacity:       isDragging ? 0.72 : undefined,
                    zIndex:        isDragging ? 200  : undefined,
                    outline:       isSelected ? '2px solid rgba(255,255,255,0.45)' : undefined,
                    outlineOffset: isSelected ? '4px' : undefined,
                    borderRadius:  isSelected ? '4px' : undefined,
                  }}
                  data-no-pan
                  className={isDragMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : undefined}
                  onPointerDown={isDragMode ? (e) => handleNodeDragStart(e, task.id) : undefined}
                >
                  <QuestNode data={{
                    task,
                    status:           entry.status,
                    lockReason:       entry.lockReason,
                    levelGap:         entry.levelGap,
                    dimmed:           isDragMode && filteredIds !== null && !filteredIds.has(task.id),
                    isSubgraphTarget: subgraphTargetIds?.has(task.id) ?? false,
                    isMapTarget:      !filterKappa && !filterLK && selectedMaps.size > 0 && (filteredIds?.has(task.id) ?? false),
                    freshlyUnlocked:  freshlyUnlocked.has(task.id),
                    pinned:           pinnedSet.has(task.id),
                    traderLevels,
                    chainRole:        getChainRole(task.id),
                    barterCount:      bartersByQuest?.[task.id]?.length ?? 0,
                    onToggle:         handleToggle,
                    onForceComplete:  handleForceComplete,
                    onPin:            togglePin,
                    onSelect:         setSelectedTask,
                    onHover:          handleHover,
                  }} />
                </div>
              );
            })}

          </QuestMapViewport>

          {/* Левый дровер «Поиск по заданию» (десктоп; мобилка — отдельным проходом) */}
          <div className="hidden lg:block">
            <QuestSearchDrawer
              open={searchOpen}
              onClose={() => setSearchOpen(false)}
              tasks={initialTasks}
              bartersByQuest={bartersByQuest}
              onSelectResult={handleSearchResult}
            />
          </div>

          {/* Drag mode controls */}
          {/* Дев-режим расстановки нод — только десктоп */}
          {/* Дев-инструменты drag-режима — «Правка» уехала в топбар (рядом с фуллскрином);
              здесь остаются Копировать/Сброс, видимы только при перемещённых нодах. */}
          <div className="absolute top-14 right-2 z-40 hidden items-center gap-1.5 lg:flex" data-no-pan>
            {manualPositions.size > 0 && (
              <>
                <button
                  onClick={() => {
                    const json = JSON.stringify(Object.fromEntries(manualPositions), null, 2);
                    navigator.clipboard.writeText(json).catch(() => {});
                  }}
                  className="h-7 px-2.5 rounded-xs text-type-caption font-blender-medium uppercase tracking-widest border bg-card-menu border-lines-hover text-text-secondary hover:text-text-primary transition-colors duration-150"
                  title="Скопировать позиции в буфер — вставить Клоду"
                >
                  Копировать позиции
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm('Сбросить все ручные позиции?')) return;
                    setManualPositions(new Map());
                    try { localStorage.removeItem(DRAG_POSITIONS_KEY); } catch {}
                  }}
                  className="h-7 px-2.5 rounded-xs text-type-caption font-blender-medium uppercase tracking-widest border bg-card-menu border-lines-hover text-text-secondary hover:text-red-400 transition-colors duration-150"
                >
                  Сброс
                </button>
              </>
            )}
          </div>

          {unlockedCount > 1 && (
            <div className="absolute bottom-4 left-4 z-50 flex items-center gap-2 rounded-xs border border-(--primary)/40 bg-card-menu px-3 py-2">
              <span className="icon-bg icon-eft-quests-active w-3 h-3 shrink-0" />
              <span className="text-type-caption font-blender-medium uppercase text-(--primary)">
                Разблокировано: {unlockedCount} квестов
              </span>
            </div>
          )}

          {/* Плавающие доки (десктоп): прогресс низ-лево · локации низ-центр · действия низ-право */}
          <div className="pointer-events-none absolute bottom-3.5 left-3.5 z-20 hidden items-center gap-1.5 rounded border border-lines-hover bg-card-menu px-3 py-1.5 backdrop-blur-sm lg:flex">
            <span className="font-blender-medium text-sm uppercase tracking-widest text-success/25">Выполнено:</span>
            <span className="font-blender-medium text-sm text-success">{completedQuests.length}</span>
            <span className="font-blender-medium text-sm text-text-secondary">/ {initialTasks.length} - {initialTasks.length ? Math.round((completedQuests.length / initialTasks.length) * 100) : 0}%</span>
          </div>
          <QuestLocationDock maps={maps} selectedMaps={selectedMaps} onMap={handleMap} />
          <QuestActionsDock onExport={handleExport} onImport={handleImport} onResetProgress={() => setResetModalOpen(true)} />

          {/* Pinned panel — absolute overlay at bottom of map */}
          {pinnedQuests.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center gap-2 px-3 h-11 bg-black/35 backdrop-blur-2xl overflow-x-auto">
              <div className="w-7 h-7 flex items-center justify-center shrink-0">
                <Paperclip className="w-4 h-4 text-text-muted" />
              </div>
              {pinnedQuests.map(id => {
                const task = initialTasks.find(t => t.id === id);
                if (!task) return null;
                return (
                  <div key={id} className="flex items-center gap-1.5 h-7 bg-card-menu px-2 rounded shrink-0 text-text-secondary">
                    <img
                      src={traderImg(task.trader.normalizedName)}
                      alt={task.trader.name}
                      width={16} height={16}
                      className="rounded-xs shrink-0"
                    />
                    <button
                      className="text-type-caption font-blender-medium uppercase tracking-widest truncate max-w-36 text-text-secondary hover:text-text-primary transition-colors duration-150"
                      onClick={() => flyToQuest(id, 1.4, 500)}
                    >
                      {task.name}
                    </button>
                    <button
                      onClick={() => togglePin(id)}
                      className="text-type-caption leading-none text-text-secondary hover:text-(--primary) transition-colors duration-150"
                      aria-label="Снять закладку"
                    >✕</button>
                  </div>
                );
              })}
            </div>
          )}

          </div>
        </div>

        {/* Мобилка — прежний статус-бар (десктоп: плавающие доки внутри канваса — прогресс/локации/действия) */}
        <div className="lg:hidden">
          <QuestStatusBar
            totalQuests={initialTasks.length}
            completedCount={completedQuests.length}
            kappaTotal={kappaTotal}
            kappaCompleted={kappaCompleted}
            lkTotal={lkTotal}
            lkCompleted={lkCompleted}
            filterKappa={filterKappa}
            filterLK={filterLK}
            onKappa={handleKappaClick}
            onLK={handleLKClick}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen(v => !v)}
            onResetProgress={() => setResetModalOpen(true)}
            onExport={handleExport}
            onImport={handleImport}
          />
        </div>
        <QuestDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          barters={selectedTask ? bartersByQuest?.[selectedTask.id] : undefined}
        />
      </div>

      <QuestResetModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={resetProgress}
      />
    </>
  );
}