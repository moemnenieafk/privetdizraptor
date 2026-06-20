'use client';

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import type { TaskRaw, QuestNodeStatus, QuestLockReason } from '@/types/quest';
import { QuestNode } from '@/components/features/quests/QuestNode';
import { QuestFilterBar } from '@/components/features/quests/QuestFilterBar';
import { QuestResetModal } from '@/components/features/quests/QuestResetModal';
import { QuestDrawer } from '@/components/features/quests/QuestDrawer';
import { QuestStatusBar } from '@/components/features/quests/QuestStatusBar';
import { useQuestStore, exportProgress, importProgress } from '@/store/useQuestStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { TraderNode } from '@/components/features/quests/TraderNode';
import { StubNode, CollapsedStub } from '@/components/features/quests/StubNode';
import { TRADER_COLORS } from '@/data/traderColors';
import {
  QuestMapViewport,
  type QuestMapViewportRef,
  type ConnectionDef,
  type Bounds,
} from '@/components/features/quests/QuestMapViewport';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { Paperclip } from 'lucide-react';

interface Props { initialTasks: TaskRaw[] }

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_W         = 348;
const NODE_H         = 90;
const TRADER_W       = 168;
const TRADER_H       = 196;
const QUEST_START_Y  = TRADER_H + 72;   // 268
const CELL_GAP       = 40;
const ROW_GAP        = 96;
const COLUMN_GAP     = 160;
const MAX_PER_ROW    = 4;
const LAST_QUEST_KEY = 'cta-last-quest-id';
const BASE_RE        = /-(day|night)$/i;

const STUB_W            = 180;
const STUB_H            = 52;
const STUB_GAP          = 8;
const MAX_STUBS_VISIBLE = 5;
const OBJ_ROW_H         = 36;
const CARD_BASE_H       = 160;

function getQuestNodeHeight(objCount: number): number {
  return CARD_BASE_H + Math.min(objCount, 5) * OBJ_ROW_H + (objCount > 5 ? 24 : 0);
}

// ─── Global quest depths (prerequisite chain length) ─────────────────────────

function computeGlobalDepths(tasks: TaskRaw[]): Map<string, number> {
  const prereqMap = new Map<string, string[]>(
    tasks.map(t => [t.id, t.taskRequirements.map(r => r.task.id)])
  );
  const depths    = new Map<string, number>();
  const computing = new Set<string>();

  function depth(id: string): number {
    if (depths.has(id))    return depths.get(id)!;
    if (computing.has(id)) return 0; // cycle guard
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
  const depths = computeGlobalDepths(tasks);
  const CELL_W = NODE_W + CELL_GAP;

  const byTrader = new Map<string, TaskRaw[]>();
  for (const t of tasks) {
    const list = byTrader.get(t.trader.normalizedName) ?? [];
    list.push(t);
    byTrader.set(t.trader.normalizedName, list);
  }

  const traderOrder        = [...byTrader.keys()];
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

    let maxColW  = 0;
    let currentY = QUEST_START_Y;

    for (const dep of [...depthGroups.keys()].sort((a, b) => a - b)) {
      const group      = depthGroups.get(dep)!;
      const numSubrows = Math.ceil(group.length / MAX_PER_ROW);

      for (let sr = 0; sr < numSubrows; sr++) {
        const row = group.slice(sr * MAX_PER_ROW, (sr + 1) * MAX_PER_ROW);
        for (let i = 0; i < row.length; i++) {
          const h = getQuestNodeHeight(row[i].objectives.length);
          positions.set(row[i].id, { x: currentX + i * CELL_W, y: currentY });
          nodeHeights.set(row[i].id, h);
        }
        const rowMaxH = Math.max(...row.map(q => getQuestNodeHeight(q.objectives.length)));
        const rowW    = row.length * CELL_W - CELL_GAP;
        if (rowW > maxColW) maxColW = rowW;
        currentY += rowMaxH + ROW_GAP;
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
    const effectiveWidth = Math.max(maxColW, TRADER_W);

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

// ─── Stepped+Rounded connector (TB: bottom-of-source → top-of-target) ────────

function makeQuestPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  if (Math.abs(dx) < 2) return `M ${x1} ${y1} V ${y2}`;

  const safeR = Math.min(28, (y2 - y1) / 4);
  const sx    = dx > 0 ? 1 : -1;
  const midY  = (y1 + y2) / 2;
  const sweepA = dx > 0 ? 1 : 0;
  const sweepB = dx > 0 ? 0 : 1;

  return [
    `M ${x1} ${y1}`,
    `V ${midY - safeR}`,
    `A ${safeR} ${safeR} 0 0 ${sweepA} ${x1 + sx * safeR} ${midY}`,
    `L ${x2 - sx * safeR} ${midY}`,
    `A ${safeR} ${safeR} 0 0 ${sweepB} ${x2} ${midY + safeR}`,
    `V ${y2}`,
  ].join(' ');
}

// ─── Status ───────────────────────────────────────────────────────────────────

type StatusEntry = { status: QuestNodeStatus; lockReason?: QuestLockReason; levelGap?: number };

function computeStatusMap(
  tasks: TaskRaw[],
  completedSet: Set<string>,
  playerLevel: number,
): Map<string, StatusEntry> {
  const map = new Map<string, StatusEntry>();
  for (const task of tasks) {
    if (completedSet.has(task.id)) { map.set(task.id, { status: 'completed' }); continue; }
    const prereqsOk = task.taskRequirements.every(r => completedSet.has(r.task.id));
    const levelOk   = playerLevel >= task.minPlayerLevel;
    if (prereqsOk && levelOk) {
      map.set(task.id, { status: 'active' });
    } else if (!prereqsOk && !levelOk) {
      map.set(task.id, { status: 'locked', lockReason: 'both', levelGap: task.minPlayerLevel - playerLevel });
    } else if (!prereqsOk) {
      map.set(task.id, { status: 'locked', lockReason: 'prereq' });
    } else {
      map.set(task.id, { status: 'locked', lockReason: 'level', levelGap: task.minPlayerLevel - playerLevel });
    }
  }
  return map;
}

// ─── Filter ───────────────────────────────────────────────────────────────────

function computeFilteredIds(
  tasks: TaskRaw[],
  filterKappa: boolean,
  filterLK: boolean,
  selectedTraders: Set<string>,
  selectedMaps: Set<string>,
): Set<string> | null {
  if (!filterKappa && !filterLK && selectedTraders.size === 0 && selectedMaps.size === 0) return null;
  return new Set(
    tasks.filter(t => {
      if (filterKappa && !t.kappaRequired)       return false;
      if (filterLK    && !t.lightkeeperRequired)  return false;
      if (selectedTraders.size > 0 && !selectedTraders.has(t.trader.normalizedName)) return false;
      if (selectedMaps.size > 0) {
        const taskMaps = t.objectives
          .filter(o => o.__typename === 'TaskObjectiveBasic' && o.maps?.length)
          .flatMap(o => (o.maps ?? []).map(m => m.normalizedName.replace(BASE_RE, '')));
        if (taskMaps.length > 0 && !taskMaps.some(id => selectedMaps.has(id))) return false;
      }
      return true;
    }).map(t => t.id)
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuestMapClient({ initialTasks: rawTasks }: Props) {
  const searchParams = useSearchParams();

  // Story quests (trader === 'stories') are excluded from the quest map
  const initialTasks = useMemo(
    () => rawTasks.filter(t => t.trader.normalizedName !== 'stories'),
    [rawTasks],
  );

  const [selectedTask, setSelectedTask]       = useState<TaskRaw | null>(null);
  const [filterKappa, setFilterKappa]         = useState(false);
  const [filterLK, setFilterLK]               = useState(false);
  const [selectedTraders, setSelectedTraders] = useState<Set<string>>(() => {
    const t = searchParams.get('trader');
    return t ? new Set([t]) : new Set();
  });
  const [selectedMaps, setSelectedMaps]       = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [freshlyUnlocked, setFreshlyUnlocked] = useState<Set<string>>(new Set());
  const [unlockedCount, setUnlockedCount]     = useState(0);
  const [searchOpen, setSearchOpen]           = useState(false);
  const [hoveredId, setHoveredId]             = useState<string | null>(null);

  const vpRef = useRef<QuestMapViewportRef | null>(null);

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

  // ── Status + filter ──────────────────────────────────────────────────────
  const statusMap = useMemo(
    () => computeStatusMap(initialTasks, new Set(completedQuests), playerLevel),
    [completedQuests, playerLevel, initialTasks],
  );

  const filteredIds = useMemo(
    () => computeFilteredIds(initialTasks, filterKappa, filterLK, selectedTraders, selectedMaps),
    [initialTasks, filterKappa, filterLK, selectedTraders, selectedMaps],
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
      const childPos    = layoutPositions.get(childId);
      if (!childPos) continue;
      const visCount    = Math.min(prereqs.length, MAX_STUBS_VISIBLE);
      const rowWidth    = visCount * (STUB_W + STUB_GAP) - STUB_GAP;
      map.set(childId, {
        x: childPos.x + NODE_W / 2 - rowWidth / 2,
        y: childPos.y - STUB_H - 12,
      });
    }
    return map;
  }, [crossTraderEdges, layoutPositions]);

  // ── Static Connections (no chainSet — ключевой фикс FPS) ─────────────────
  const staticConnections = useMemo<ConnectionDef[]>(() => {
    const result: ConnectionDef[] = [];
    const taskById = new Map(initialTasks.map(t => [t.id, t]));

    function isLinearChain(parentId: string, childId: string): boolean {
      return (childrenMap.get(parentId)?.length ?? 0) === 1
          && (parentsMap.get(childId)?.length ?? 0) === 1;
    }

    for (const task of initialTasks) {
      for (const req of task.taskRequirements) {
        const edgeId = `${req.task.id}->${task.id}`;
        if (!staticEdgeIds.has(edgeId)) continue;

        const srcTask = taskById.get(req.task.id);
        if (!srcTask) continue;
        if (srcTask.trader.normalizedName !== task.trader.normalizedName) continue;

        const srcPos = layoutPositions.get(req.task.id);
        const tgtPos = layoutPositions.get(task.id);
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
          d:       isLinearChain(req.task.id, task.id)
            ? `M ${srcPos.x + NODE_W / 2} ${srcPos.y + srcH} L ${tgtPos.x + NODE_W / 2} ${tgtPos.y}`
            : makeQuestPath(srcPos.x + NODE_W / 2, srcPos.y + srcH, tgtPos.x + NODE_W / 2, tgtPos.y),
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
      const traderPos = layoutPositions.get(`trader-${traderName}`);
      if (!traderPos) continue;
      for (const rootId of rootIds.slice(0, 4)) {
        const questPos = layoutPositions.get(rootId);
        if (!questPos) continue;
        result.push({
          id:        `trader-${traderName}->${rootId}`,
          d:         `M ${traderPos.x + TRADER_W / 2} ${traderPos.y + TRADER_H} L ${questPos.x + NODE_W / 2} ${questPos.y}`,
          stroke:    traderVar,
          opacity:   0.5,
          nodeIds:   [`trader-${traderName}`, rootId],
          className: 'qc-active',
        });
      }
    }

    // Ref portrait inlined — lines from depth-0 ref quests → portrait
    const refPortraitPos = layoutPositions.get('trader-ref');
    if (refPortraitPos) {
      const refVar      = `var(${traderCssVar('ref')})`;
      const refQuests   = initialTasks.filter(t => t.trader.normalizedName === 'ref');
      const refQuestIds = new Set(refQuests.map(q => q.id));
      const refRoots    = refQuests.filter(q =>
        !(parentsMap.get(q.id) ?? []).some(pid => refQuestIds.has(pid))
      );
      for (const q of refRoots) {
        const qPos = layoutPositions.get(q.id);
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
      const childPos = layoutPositions.get(childId);
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
  }, [initialTasks, layoutPositions, nodeHeights, statusMap, staticEdgeIds, traderRoots,
      crossTraderEdges, stubRowPositions, childrenMap, parentsMap]);

  const tradersInFilter = useMemo(
    () => filteredIds === null
      ? null
      : new Set(initialTasks.filter(t => filteredIds.has(t.id)).map(t => t.trader.normalizedName)),
    [filteredIds, initialTasks],
  );

  const pinnedSet = useMemo(() => new Set(pinnedQuests), [pinnedQuests]);

  // ── Navigate to a quest ──────────────────────────────────────────────────
  const flyToQuest = useCallback((id: string, zoom = 1.2, duration = 0) => {
    const pos = layoutPositionsRef.current.get(id);
    if (pos) vpRef.current?.setCenter(pos.x + NODE_W / 2, pos.y + NODE_H / 2, { zoom, duration });
  }, []);

  // ── Initial view on mount ────────────────────────────────────────────────
  useEffect(() => {
    let raf1 = 0, raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const vp = vpRef.current;
        if (!vp) return;

        // Restore last visited quest
        const lastId = localStorage.getItem(LAST_QUEST_KEY);
        if (lastId && layoutPositionsRef.current.has(lastId)) {
          flyToQuest(lastId, 1.2, 0);
          return;
        }

        // First root quest of first trader
        const firstTrader = traderOrderRef.current[0];
        if (firstTrader) {
          const roots   = traderRootsRef.current.get(firstTrader) ?? [];
          const targetId = roots[0] ?? initialTasks.find(t => t.trader.normalizedName === firstTrader)?.id;
          if (targetId) { flyToQuest(targetId, 1.0, 0); return; }
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
    const { completedQuests: nowCompleted, toggleQuest, pinnedQuests: nowPinned } = useQuestStore.getState();
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

  // Toggle-once: deselect if already active, else select and fly to first quest
  const handleTrader = useCallback((name: string) => {
    setSelectedTraders(prev => {
      if (prev.has(name)) return new Set();
      // Navigate to first root/entry quest of this trader at zoom 1.0
      const roots    = traderRootsRef.current.get(name) ?? [];
      const targetId = roots[0] ?? initialTasks.find(t => t.trader.normalizedName === name)?.id;
      if (targetId) flyToQuest(targetId, 1.0, 500);
      return new Set([name]);
    });
  }, [initialTasks, flyToQuest]);

  const handleReset = () => {
    setFilterKappa(false);
    setFilterLK(false);
    setSelectedTraders(new Set());
    setSelectedMaps(new Set());
  };

  const handleFocusNode = useCallback((task: TaskRaw) => { flyToQuest(task.id, 1.5, 500); }, [flyToQuest]);

  const containerCls   = isFullscreen ? 'fixed inset-0 z-[100] flex flex-col bg-(--color-base) overflow-hidden' : 'relative flex flex-col w-275 h-192 mx-auto outline outline-2 outline-(--color-lines-hover) rounded-lg overflow-hidden';
  const containerStyle = isFullscreen ? undefined : undefined;

  return (
    <>
      <div className={containerCls} style={containerStyle}>
        <QuestFilterBar
          tasks={initialTasks}
          completedQuests={completedQuests}
          filterKappa={filterKappa}
          filterLK={filterLK}
          selectedTraders={selectedTraders}
          onKappa={() => setFilterKappa(v => !v)}
          onLK={() => setFilterLK(v => !v)}
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

        <div className="flex flex-1 min-h-0">

          <div className="relative flex-1 min-w-0">
            <QuestMapViewport
              ref={vpRef}
              connections={staticConnections}
              chainSet={chainSet}
              className="absolute inset-0"
            >
            {/* Trader portraits */}
            {traderOrder.map(traderName => {
              const pos     = layoutPositions.get(`trader-${traderName}`);
              const srcTask = initialTasks.find(t => t.trader.normalizedName === traderName);
              if (!pos || !srcTask) return null;
              return (
                <div
                  key={`trader-${traderName}`}
                  style={{ position: 'absolute', left: pos.x, top: pos.y }}
                  data-no-pan
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
              const pos = layoutPositions.get(task.id);
              if (!pos) return null;
              const entry = statusMap.get(task.id) ?? { status: 'locked' as QuestNodeStatus };
              return (
                <div
                  key={task.id}
                  style={{ position: 'absolute', left: pos.x, top: pos.y }}
                  data-no-pan
                >
                  <QuestNode data={{
                    task,
                    status:          entry.status,
                    lockReason:      entry.lockReason,
                    levelGap:        entry.levelGap,
                    dimmed:          filteredIds !== null && !filteredIds.has(task.id),
                    freshlyUnlocked: freshlyUnlocked.has(task.id),
                    pinned:          pinnedSet.has(task.id),
                    traderLevels,
                    chainRole:       getChainRole(task.id),
                    onToggle:        handleToggle,
                    onForceComplete: handleForceComplete,
                    onPin:           togglePin,
                    onSelect:        setSelectedTask,
                    onHover:         handleHover,
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

          {unlockedCount > 1 && (
            <div className="absolute bottom-4 left-4 z-50 flex items-center gap-2 rounded-xs border border-(--primary)/40 bg-card-menu px-3 py-2">
              <span className="icon-bg icon-eft-quests-active w-3 h-3 shrink-0" />
              <span className="text-[10px] font-blender-medium uppercase text-(--primary)">
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
                      className="rounded-[1px] shrink-0"
                    />
                    <button
                      className="text-[10px] font-blender-medium uppercase tracking-widest truncate max-w-36 text-text-secondary hover:text-text-primary transition-colors duration-150"
                      onClick={() => flyToQuest(id, 1.4, 500)}
                    >
                      {task.name}
                    </button>
                    <button
                      onClick={() => togglePin(id)}
                      className="text-[10px] leading-none text-text-secondary hover:text-(--primary) transition-colors duration-150"
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
          onKappa={() => setFilterKappa(v => !v)}
          onLK={() => setFilterLK(v => !v)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(v => !v)}
          onExport={handleExport}
          onImport={handleImport}
        />
        <QuestDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      </div>

      <QuestResetModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={resetProgress}
      />
    </>
  );
}
