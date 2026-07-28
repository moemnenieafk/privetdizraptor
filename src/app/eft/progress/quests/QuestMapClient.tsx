'use client';

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import type { TaskRaw, QuestNodeStatus, QuestBarterLite } from '@/types/quest';
import { computeStatusMap } from '@/lib/quest-status';
import { QuestNode } from '@/components/features/quests/QuestNode';
import { QuestFilterBar } from '@/components/features/quests/QuestFilterBar';
import { QuestResetModal } from '@/components/features/quests/QuestResetModal';
import { QuestDrawer } from '@/components/features/quests/QuestDrawer';
import { QuestStatusBar } from '@/components/features/quests/QuestStatusBar';
import { MobileQuestBar } from '@/components/features/quests/MobileQuestBar';
import { QuestSearchSheet } from '@/components/features/quests/QuestSearchSheet';
import { QuestTraderSheet } from '@/components/features/quests/QuestTraderSheet';
import { QuestMapsSheet } from '@/components/features/quests/QuestMapsSheet';
import { MAP_ICON_CSS as MAP_CSS } from '@/data/map-icons';
import { useQuestStore, exportProgress, importProgress } from '@/store/useQuestStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { TraderNode } from '@/components/features/quests/TraderNode';
import { StubNode, CollapsedStub } from '@/components/features/quests/StubNode';
import { TRADER_COLORS } from '@/data/traderColors';
import {
  QuestMapViewport,
  type QuestMapViewportRef,
  type ConnectionDef,
  type BackgroundRect,
  type Bounds,
} from '@/components/features/quests/QuestMapViewport';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { makeQuestPath } from '@/lib/quest-path';
import { Paperclip } from 'lucide-react';
import PRESET_POSITIONS from '@/data/quests/quest-positions.json';

interface Props { initialTasks: TaskRaw[]; bartersByQuest?: Record<string, QuestBarterLite[]> }

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_W         = 348;
const NODE_H         = 90;
const TRADER_W       = 168;
const TRADER_H       = 196;
const QUEST_START_Y  = TRADER_H + 72;   // 268
const CELL_GAP       = 164;
const ROW_GAP        = 256;
const COLUMN_GAP     = 256;
const MAX_PER_ROW    = 15;
const LAST_QUEST_KEY = 'cta-last-quest-id';
const BASE_RE        = /-(day|night)$/i;

const STUB_W            = 180;
const STUB_H            = 52;
const STUB_GAP          = 8;
const MAX_STUBS_VISIBLE = 5;

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
const MAX_PER_ROW_ODD   = 13;                                // cards per odd (staggered) row
const MAX_CARD_H        = CARD_BASE_H + 5 * OBJ_ROW_H + 24; // 364 — max card height (5 objectives + overflow badge)
const ROW_STEP          = MAX_CARD_H + ROW_GAP;              // 620 — fixed row height (chess grid)
const SNAP_ROW_H        = ROW_STEP;                          // 620 — snap grid row step
const DRAG_POSITIONS_KEY = 'cta-quest-positions';

function getQuestNodeHeight(objCount: number): number {
  return CARD_BASE_H + Math.min(objCount, 5) * OBJ_ROW_H + (objCount > 5 ? 24 : 0);
}

// ─── Local quest depths (same-trader chain only) ──────────────────────────────

function computeLocalDepths(tasks: TaskRaw[]): Map<string, number> {
  const prereqMap = new Map<string, string[]>(
    tasks.map(t => [t.id, t.taskRequirements
      .filter(r => {
        const parent = tasks.find(p => p.id === r.task.id);
        return parent && parent.trader.normalizedName === t.trader.normalizedName;
      })
      .map(r => r.task.id)
    ])
  );
  const depths    = new Map<string, number>();
  const computing = new Set<string>();

  function depth(id: string): number {
    if (depths.has(id))    return depths.get(id)!;
    if (computing.has(id)) return 0;
    computing.add(id);
    const pids = prereqMap.get(id) ?? [];
    const d    = pids.length === 0 ? 0 : 1 + Math.max(...pids.map(depth));
    computing.delete(id);
    depths.set(id, d);
    return d;
  }

  for (const t of tasks) depth(t.id);
  return depths;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface LayoutResult {
  layoutPositions:    Map<string, { x: number; y: number }>;
  staticEdgeIds:      Set<string>;
  traderOrder:        string[];
  traderRoots:        Map<string, string[]>;
  traderColumnBounds: Map<string, Bounds>;
  graphBounds:        Bounds;
  nodeHeights:        Map<string, number>;
}

function computeLayout(tasks: TaskRaw[]): LayoutResult {
  const depths   = computeLocalDepths(tasks);
  const CELL_W   = NODE_W + CELL_GAP;
  const taskById = new Map(tasks.map(t => [t.id, t]));

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
  const traderRoots        = new Map<string, string[]>();
  const edgeIds            = new Set<string>();

  for (const t of tasks)
    for (const r of t.taskRequirements) edgeIds.add(`${r.task.id}->${t.id}`);

  let currentX = 0;

  for (const traderName of traderOrder) {
    const quests = byTrader.get(traderName)!;

    // Absolute roots (no prereqs at all) — used for portrait connections
    const roots: string[] = [];
    for (const q of quests) {
      if (q.taskRequirements.length === 0) roots.push(q.id);
    }
    traderRoots.set(traderName, roots);

    // Sort by global depth then name for a stable ordering
    const sorted = [...quests].sort((a, b) => {
      const da = depths.get(a.id) ?? 0;
      const db = depths.get(b.id) ?? 0;
      return da !== db ? da - db : a.name.localeCompare(b.name);
    });

    // Group by depth
    const depthGroups = new Map<number, TaskRaw[]>();
    for (const q of sorted) {
      const d = depths.get(q.id) ?? 0;
      const g = depthGroups.get(d) ?? [];
      g.push(q);
      depthGroups.set(d, g);
    }

    let currentY  = QUEST_START_Y;
    let rowIndex  = 0;                     // persists across depth groups → global chess pattern
    const COL_PAD = ROW_STAGGER;           // 256px left margin inside column

    for (const dep of [...depthGroups.keys()].sort((a, b) => a - b)) {
      const group = depthGroups.get(dep)!;

      // Sort by avg X of same-trader parents already placed (reduces edge crossings)
      const sortedGroup = [...group].sort((a, b) => {
        const avgX = (q: TaskRaw) => {
          const parents = q.taskRequirements
            .map(r => taskById.get(r.task.id))
            .filter((p): p is TaskRaw => !!p && p.trader.normalizedName === q.trader.normalizedName);
          if (parents.length === 0) return 0;
          const xs = parents.map(p => positions.get(p.id)?.x ?? 0);
          return xs.reduce((s, x) => s + x, 0) / xs.length;
        };
        return avgX(a) - avgX(b);
      });

      let processed = 0;
      while (processed < sortedGroup.length) {
        const maxSlots = rowIndex % 2 === 0 ? MAX_PER_ROW : MAX_PER_ROW_ODD;
        const baseOff  = rowIndex % 2 === 0 ? COL_PAD : COL_PAD + ROW_STAGGER;
        const row      = sortedGroup.slice(processed, processed + maxSlots);
        const offset   = baseOff + Math.floor((maxSlots - row.length) / 2) * CELL_W;
        for (let i = 0; i < row.length; i++) {
          positions.set(row[i].id, { x: currentX + offset + i * CELL_W, y: currentY });
          nodeHeights.set(row[i].id, getQuestNodeHeight(row[i].objectives.length));
        }
        currentY += ROW_STEP;
        processed += row.length;
        rowIndex++;
      }
    }

    // Ref: portrait inlined between depth 0 and depth 1, not at top
    let portraitY = 0;
    if (traderName === 'ref') {
      const depthKeys = [...depthGroups.keys()].sort((a, b) => a - b);
      if (depthKeys.length >= 2) {
        const depth0 = depthGroups.get(depthKeys[0])!;
        const maxH0  = Math.max(...depth0.map(q => getQuestNodeHeight(q.objectives.length)));
        const y0     = positions.get(depth0[0].id)?.y ?? QUEST_START_Y;
        portraitY    = y0 + maxH0 + ROW_GAP;
        const shift  = TRADER_H + ROW_GAP;
        for (const dk of depthKeys.slice(1)) {
          for (const q of depthGroups.get(dk)!) {
            const p = positions.get(q.id);
            if (p) positions.set(q.id, { x: p.x, y: p.y + shift });
          }
        }
        currentY += shift;
      }
    }

    const colHeight      = currentY - QUEST_START_Y;
    const effectiveWidth = Math.max(COL_PAD * 2 + MAX_PER_ROW * CELL_W - CELL_GAP, TRADER_W);

    positions.set(`trader-${traderName}`, {
      x: currentX + effectiveWidth / 2 - TRADER_W / 2,
      y: portraitY,
    });

    traderColumnBounds.set(traderName, {
      minX: currentX - 20,
      minY: 0,
      maxX: currentX + effectiveWidth + 20,
      maxY: QUEST_START_Y + colHeight + 20,
    });

    currentX += effectiveWidth + COLUMN_GAP;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [id, p] of positions) {
    const isT = id.startsWith('trader-');
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + (isT ? TRADER_W : NODE_W));
    maxY = Math.max(maxY, p.y + (isT ? TRADER_H : (nodeHeights.get(id) ?? NODE_H)));
  }

  return {
    layoutPositions:    positions,
    staticEdgeIds:      edgeIds,
    traderOrder,
    traderRoots,
    traderColumnBounds,
    nodeHeights,
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
  ancestorMap: Map<string, Set<string>>,
): { filteredIds: Set<string> | null; subgraphTargetIds: Set<string> | null } {
  if (filterKappa || filterLK)
    return computeMinSubgraph(tasks, filterKappa, filterLK, ancestorMap);
  if (selectedTraders.size === 0 && selectedMaps.size === 0)
    return { filteredIds: null, subgraphTargetIds: null };
  return {
    filteredIds: new Set(
      tasks.filter(t => {
        if (selectedTraders.size > 0 && !selectedTraders.has(t.trader.normalizedName)) return false;
        if (selectedMaps.size > 0) {
          const taskMaps = t.objectives
            .filter(o => o.__typename === 'TaskObjectiveBasic' && o.maps?.length)
            .flatMap(o => (o.maps ?? []).map(m => m.normalizedName.replace(BASE_RE, '')));
          if (taskMaps.length > 0 && !taskMaps.some(id => selectedMaps.has(id))) return false;
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
  const [selectedTraders, setSelectedTraders] = useState<Set<string>>(() => {
    const t = searchParams.get('trader');
    const normalized = t === 'btr-driver' ? 'btrdriver' : t;
    return normalized ? new Set([normalized]) : new Set();
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

  const vpRef           = useRef<QuestMapViewportRef | null>(null);
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
    staticEdgeIds,
    traderOrder,
    traderRoots,
    traderColumnBounds,
    graphBounds,
    nodeHeights,
  } = useMemo(() => computeLayout(initialTasks), [initialTasks]);

  const layoutPositionsRef     = useRef(layoutPositions);
  layoutPositionsRef.current   = layoutPositions;
  const graphBoundsRef         = useRef(graphBounds);
  graphBoundsRef.current       = graphBounds;
  const traderColumnBoundsRef  = useRef(traderColumnBounds);
  traderColumnBoundsRef.current = traderColumnBounds;
  const traderOrderRef         = useRef(traderOrder);
  traderOrderRef.current       = traderOrder;
  const traderRootsRef         = useRef(traderRoots);
  traderRootsRef.current       = traderRoots;

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

  const { filteredIds, subgraphTargetIds } = useMemo(
    () => computeFilteredIds(initialTasks, filterKappa, filterLK, selectedTraders, selectedMaps, ancestorMap),
    [initialTasks, filterKappa, filterLK, selectedTraders, selectedMaps, ancestorMap],
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

  // Stubs подсвечиваются как descendant при ховере на оригинал
  const getStubChainRole = useCallback((origId: string): 'ancestor' | 'descendant' | 'self' | null | undefined => {
    if (hoveredId === origId) return 'descendant';
    return getChainRole(origId);
  }, [hoveredId, getChainRole]);

  // ── Cross-trader edges ───────────────────────────────────────────────────
  const crossTraderEdges = useMemo(() => {
    const map = new Map<string, TaskRaw[]>();
    for (const task of initialTasks) {
      const foreignPrereqs = task.taskRequirements
        .map(r => initialTasks.find(t => t.id === r.task.id))
        .filter((p): p is TaskRaw => !!p && p.trader.normalizedName !== task.trader.normalizedName);
      if (foreignPrereqs.length > 0) map.set(task.id, foreignPrereqs);
    }
    return map;
  }, [initialTasks]);

  // ── Stub row positions ───────────────────────────────────────────────────
  const stubRowPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const [childId, prereqs] of crossTraderEdges) {
      const childPos    = connPositions.get(childId);
      if (!childPos) continue;
      const visCount    = Math.min(prereqs.length, MAX_STUBS_VISIBLE);
      const rowWidth    = visCount * (STUB_W + STUB_GAP) - STUB_GAP;
      map.set(childId, {
        x: childPos.x + NODE_W / 2 - rowWidth / 2,
        y: childPos.y - STUB_H - 12,
      });
    }
    return map;
  }, [crossTraderEdges, connPositions]);

  // ── Static Connections (no chainSet — ключевой фикс FPS) ─────────────────
  const staticConnections = useMemo<ConnectionDef[]>(() => {
    const result: ConnectionDef[] = [];
    const taskById = new Map(initialTasks.map(t => [t.id, t]));

    for (const task of initialTasks) {
      for (const req of task.taskRequirements) {
        const edgeId = `${req.task.id}->${task.id}`;
        if (!staticEdgeIds.has(edgeId)) continue;

        const srcTask = taskById.get(req.task.id);
        if (!srcTask) continue;
        if (srcTask.trader.normalizedName !== task.trader.normalizedName) continue;

        const srcPos = connPositions.get(req.task.id);
        const tgtPos = connPositions.get(task.id);
        if (!srcPos || !tgtPos) continue;

        const srcStatus   = statusMap.get(req.task.id)?.status ?? 'locked';
        const traderVar   = `var(${traderCssVar(task.trader.normalizedName)})`;
        const stroke      = srcStatus === 'completed' ? 'var(--color-nvg-green)'
          : srcStatus === 'locked'  ? 'var(--color-lines-hover)'
          : traderVar;
        const baseOpacity = srcStatus === 'completed' ? 0.25 : 1.0;
        const srcH        = nodeHeights.get(req.task.id) ?? NODE_H;

        result.push({
          id:      edgeId,
          d:       makeQuestPath(srcPos.x + NODE_W / 2, srcPos.y + srcH, tgtPos.x + NODE_W / 2, tgtPos.y),
          stroke,
          opacity:   baseOpacity,
          nodeIds:   [req.task.id, task.id],
          className: `qc-${srcStatus}`,
        });
      }
    }

    // Trader portrait → root quests
    for (const [traderName, rootIds] of traderRoots) {
      if (traderName === 'ref') continue; // portrait inlined, handled separately below
      const traderVar = `var(${traderCssVar(traderName)})`;
      const traderPos = connPositions.get(`trader-${traderName}`);
      if (!traderPos) continue;
      for (const rootId of rootIds.slice(0, 4)) {
        const questPos = connPositions.get(rootId);
        if (!questPos) continue;
        result.push({
          id:        `trader-${traderName}->${rootId}`,
          d:         makeQuestPath(traderPos.x + TRADER_W / 2, traderPos.y + TRADER_H, questPos.x + NODE_W / 2, questPos.y),
          stroke:    traderVar,
          opacity:   0.5,
          nodeIds:   [`trader-${traderName}`, rootId],
          className: 'qc-active',
        });
      }
    }

    // Ref portrait inlined — lines from depth-0 ref quests → portrait
    const refPortraitPos = connPositions.get('trader-ref');
    if (refPortraitPos) {
      const refVar      = `var(${traderCssVar('ref')})`;
      const refQuests   = initialTasks.filter(t => t.trader.normalizedName === 'ref');
      const refQuestIds = new Set(refQuests.map(q => q.id));
      const refRoots    = refQuests.filter(q =>
        !(parentsMap.get(q.id) ?? []).some(pid => refQuestIds.has(pid))
      );
      for (const q of refRoots) {
        const qPos = connPositions.get(q.id);
        if (!qPos) continue;
        const qH = nodeHeights.get(q.id) ?? NODE_H;
        result.push({
          id:        `ref-root-${q.id}->portrait`,
          d:         `M ${qPos.x + NODE_W / 2} ${qPos.y + qH} L ${refPortraitPos.x + TRADER_W / 2} ${refPortraitPos.y}`,
          stroke:    refVar,
          opacity:   0.4,
          nodeIds:   [q.id, 'trader-ref'],
          className: 'qc-active',
        });
      }
    }

    // Stub → child connections
    for (const [childId, prereqs] of crossTraderEdges) {
      const childPos = connPositions.get(childId);
      const rowPos   = stubRowPositions.get(childId);
      if (!childPos || !rowPos) continue;
      const childStatus = statusMap.get(childId)?.status ?? 'locked';
      prereqs.slice(0, MAX_STUBS_VISIBLE).forEach((orig, i) => {
        const stubCenterX   = rowPos.x + i * (STUB_W + STUB_GAP) + STUB_W / 2;
        const origTraderVar = `var(${traderCssVar(orig.trader.normalizedName)})`;
        const stroke        = childStatus === 'completed' ? 'var(--color-nvg-green)'
          : childStatus === 'active' ? origTraderVar
          : 'var(--color-lines-hover)';
        result.push({
          id:        `stub-${orig.id}->${childId}-${i}`,
          d:         `M ${stubCenterX} ${rowPos.y + STUB_H} L ${childPos.x + NODE_W / 2} ${childPos.y}`,
          stroke,
          opacity:   childStatus === 'completed' ? 0.25 : 1.0,
          nodeIds:   [orig.id, childId],
          className: `qc-${childStatus}`,
        });
      });
    }

    return result;
  // chainSet намеренно исключён — ключевой фикс FPS
  }, [initialTasks, connPositions, nodeHeights, statusMap, staticEdgeIds, traderRoots,
      crossTraderEdges, stubRowPositions, childrenMap, parentsMap]);

  const columnBackgrounds = useMemo<BackgroundRect[]>(() => [], []);

  const tradersInFilter = useMemo(
    () => filteredIds === null
      ? null
      : new Set(initialTasks.filter(t => filteredIds.has(t.id)).map(t => t.trader.normalizedName)),
    [filteredIds, initialTasks],
  );

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

        // Deep-link из глобального поиска: плавный полёт к конкретному квесту (?quest=<id>)
        const focusId = searchParams.get('quest');
        if (focusId && connPositionsRef.current.has(focusId)) {
          flyToQuest(focusId, 1.4, 600);
          return;
        }

        // Restore last visited quest
        const lastId = localStorage.getItem(LAST_QUEST_KEY);
        if (lastId && connPositionsRef.current.has(lastId)) {
          flyToQuest(lastId, 1.2, 0);
          return;
        }

        // Portrait of first trader
        const firstTrader = traderOrderRef.current[0];
        if (firstTrader) {
          const pos = connPositionsRef.current.get(`trader-${firstTrader}`);
          if (pos) { vp.setCenter(pos.x + TRADER_W / 2, pos.y + TRADER_H / 2, { zoom: 1.0, duration: 0 }); return; }
        }

        // Fallback: fit entire graph
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

  // Toggle-once: deselect if already active, else select and fly to trader portrait
  const handleTrader = useCallback((name: string) => {
    setSelectedTraders(prev => {
      if (prev.has(name)) return new Set();
      const pos = connPositionsRef.current.get(`trader-${name}`);
      if (pos) vpRef.current?.setCenter(pos.x + TRADER_W / 2, pos.y + TRADER_H / 2, { zoom: fitZoom(TRADER_W), duration: 500 });
      return new Set([name]);
    });
  }, [fitZoom]);

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

  const handleReset = () => {
    setFilterKappa(false);
    setFilterLK(false);
    setSelectedTraders(new Set());
    setSelectedMaps(new Set());
  };

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

  // ── Snap: find nearest slot X in any column + nearest row Y ──────────────
  // nodeWidth: width of element being snapped (NODE_W for quests, TRADER_W for portraits).
  //   Center of element aligns with center of nearest quest slot.
  // snapYGrid: false → Y is free (trader portraits can float vertically).
  const snapPosition = useCallback((
    rawX: number, rawY: number,
    nodeWidth = NODE_W, snapYGrid = true,
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
    const snappedY = snapYGrid
      ? Math.max(QUEST_START_Y, QUEST_START_Y + Math.round((rawY - QUEST_START_Y) / SNAP_ROW_H) * SNAP_ROW_H)
      : rawY;
    return { x: bestX, y: snappedY };
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

      // Primary grid snap: portraits center over quest slots, free Y; quests snap to grid
      let { x: snX, y: snY } = snapPosition(rawX, rawY, isTrader ? TRADER_W : NODE_W, !isTrader);

      // Secondary edge-snap: align with existing quest nodes at similar Y
      if (!isTrader) {
        const OBJ_SNAP = 40; // px — magnetic radius for object alignment
        for (const [id, existPos] of connPositionsRef.current) {
          if (id === taskId || id.startsWith('trader-')) continue;
          if (Math.abs(existPos.y - rawY) > SNAP_ROW_H / 2) continue;
          // Snap targets: same column X, one slot left, one slot right
          for (const cx of [existPos.x, existPos.x - CELL_W, existPos.x + CELL_W]) {
            if (Math.abs(rawX - cx) < OBJ_SNAP && Math.abs(rawX - cx) < Math.abs(rawX - snX)) {
              snX = cx;
            }
          }
        }
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
  const containerCls   = isFullscreen
    ? 'fixed inset-0 z-[200] flex flex-col bg-(--color-base) overflow-hidden'
    : 'relative mx-auto flex h-[calc(100svh-220px)] max-h-192 min-h-105 w-full max-w-275 flex-col overflow-hidden rounded-lg outline outline-2 outline-(--color-lines-hover)';
  const containerStyle = isFullscreen ? undefined : undefined;

  return (
    <>
      <div className={containerCls} style={containerStyle}>
        {/* Мобильная верхняя панель: поиск / торговцы / карты */}
        <MobileQuestBar mapsFilterActive={selectedMaps.size > 0} />

        {/* Десктопный фильтр-бар — прячем на мобилке */}
        <div className="hidden lg:block">
        <QuestFilterBar
          tasks={initialTasks}
          completedQuests={completedQuests}
          filterKappa={filterKappa}
          filterLK={filterLK}
          selectedTraders={selectedTraders}
          onKappa={handleKappaClick}
          onLK={handleLKClick}
          onTrader={handleTrader}
          onReset={handleReset}
          onResetProgress={() => setResetModalOpen(true)}
          searchOpen={searchOpen}
          onSearchOpen={() => setSearchOpen(v => !v)}
          maps={maps}
          selectedMaps={selectedMaps}
          onMap={handleMap}
          onFocus={handleFocusNode}
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
            <QuestMapViewport
              ref={vpRef}
              connections={staticConnections}
              backgroundRects={columnBackgrounds}
              chainSet={chainSet}
              className="absolute inset-0"
              isDragMode={isDragMode}
              onBoxSelect={handleBoxSelect}
            >
            {/* Trader portraits */}
            {traderOrder.map(traderName => {
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
                    dimmed:         tradersInFilter !== null && !tradersInFilter.has(traderName),
                  }} />
                </div>
              );
            })}

            {/* Quest nodes */}
            {initialTasks.map(task => {
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
                    dimmed:           filteredIds !== null && !filteredIds.has(task.id),
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

            {/* Stubs for cross-trader prereqs */}
            {Array.from(crossTraderEdges.entries()).map(([childId, prereqs]) => {
              const rowPos = stubRowPositions.get(childId);
              if (!rowPos) return null;
              const visible   = prereqs.slice(0, MAX_STUBS_VISIBLE);
              const collapsed = prereqs.length - MAX_STUBS_VISIBLE;
              return (
                <Fragment key={`stubs-${childId}`}>
                  {visible.map((orig, i) => (
                    <div
                      key={orig.id}
                      style={{ position: 'absolute', left: rowPos.x + i * (STUB_W + STUB_GAP), top: rowPos.y, zIndex: 5 }}
                    >
                      <StubNode
                        originalTask={orig}
                        chainRole={getStubChainRole(orig.id)}
                        dimmed={filteredIds !== null && !filteredIds.has(orig.id)}
                        onFlyTo={(id, task) => {
                          flyToQuest(id, 1.5, 400);
                          setTimeout(() => setSelectedTask(task), 450);
                        }}
                      />
                    </div>
                  ))}
                  {collapsed > 0 && (
                    <div
                      style={{ position: 'absolute', left: rowPos.x + MAX_STUBS_VISIBLE * (STUB_W + STUB_GAP), top: rowPos.y, zIndex: 5 }}
                    >
                      <CollapsedStub count={collapsed} onExpand={() => {}} />
                    </div>
                  )}
                </Fragment>
              );
            })}
          </QuestMapViewport>

          {/* Drag mode controls */}
          {/* Дев-режим расстановки нод — только десктоп */}
          <div className="absolute top-2 right-2 z-40 hidden gap-1.5 lg:flex" data-no-pan>
            <button
              onClick={() => { setIsDragMode(v => !v); setSnapPreview(null); setSelectedNodes(new Set()); setGroupPreview(new Map()); }}
              className={`h-7 px-2.5 rounded-xs text-type-caption font-blender-medium uppercase tracking-widest border transition-colors duration-150 ${
                isDragMode
                  ? 'bg-(--primary)/20 border-(--primary)/50 text-(--primary)'
                  : 'bg-card-menu border-lines-hover text-text-secondary hover:text-text-primary'
              }`}
            >
              {isDragMode ? 'Правка вкл' : 'Правка'}
            </button>
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