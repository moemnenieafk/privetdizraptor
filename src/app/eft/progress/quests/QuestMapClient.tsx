'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from 'reactflow';
import { graphlib, layout } from '@dagrejs/dagre';
import { Maximize2, Minimize2 } from 'lucide-react';
import 'reactflow/dist/style.css';
import type { TaskRaw, QuestNodeStatus, QuestLockReason } from '@/types/quest';
import { QuestNode } from '@/components/features/quests/QuestNode';
import { QuestFilterBar } from '@/components/features/quests/QuestFilterBar';
import { QuestDrawer } from '@/components/features/quests/QuestDrawer';
import { QuestSearch } from '@/components/features/quests/QuestSearch';
import { useQuestStore } from '@/store/useQuestStore';
import { usePlayerStore } from '@/store/usePlayerStore';

interface Props {
  initialTasks: TaskRaw[];
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;

const nodeTypes = { questNode: QuestNode };

type StatusEntry = { status: QuestNodeStatus; lockReason?: QuestLockReason; levelGap?: number };

function computeStatusMap(
  tasks: TaskRaw[],
  completedSet: Set<string>,
  playerLevel: number,
): Map<string, StatusEntry> {
  const map = new Map<string, StatusEntry>();
  for (const task of tasks) {
    if (completedSet.has(task.id)) {
      map.set(task.id, { status: 'completed' });
      continue;
    }
    const prereqsOk = task.taskRequirements.every((r) => completedSet.has(r.task.id));
    const levelOk = playerLevel >= task.minPlayerLevel;

    if (prereqsOk && levelOk) {
      map.set(task.id, { status: 'active' });
    } else if (!prereqsOk && !levelOk) {
      map.set(task.id, {
        status: 'locked',
        lockReason: 'both',
        levelGap: task.minPlayerLevel - playerLevel,
      });
    } else if (!prereqsOk) {
      map.set(task.id, { status: 'locked', lockReason: 'prereq' });
    } else {
      map.set(task.id, {
        status: 'locked',
        lockReason: 'level',
        levelGap: task.minPlayerLevel - playerLevel,
      });
    }
  }
  return map;
}

function computeFilteredIds(
  tasks: TaskRaw[],
  filterKappa: boolean,
  filterLK: boolean,
  selectedTraders: Set<string>,
): Set<string> | null {
  if (!filterKappa && !filterLK && selectedTraders.size === 0) return null;
  return new Set(
    tasks
      .filter((t) => {
        if (filterKappa && !t.kappaRequired) return false;
        if (filterLK && !t.lightkeeperRequired) return false;
        if (selectedTraders.size > 0 && !selectedTraders.has(t.trader.normalizedName)) return false;
        return true;
      })
      .map((t) => t.id),
  );
}

function applyChainHighlight(
  layoutResult: { nodes: Node[]; edges: Edge[] },
  hoveredId: string | null,
  ancestorMap: Map<string, Set<string>>,
  descendantMap: Map<string, Set<string>>,
): { nodes: Node[]; edges: Edge[] } {
  if (hoveredId === null) return layoutResult;

  const ancestors   = ancestorMap.get(hoveredId)   ?? new Set<string>();
  const descendants = descendantMap.get(hoveredId) ?? new Set<string>();
  const chainSet    = new Set([...ancestors, hoveredId, ...descendants]);

  const nodes = layoutResult.nodes.map((node) => {
    let chainRole: 'ancestor' | 'descendant' | 'self' | null = null;
    if (node.id === hoveredId)          chainRole = 'self';
    else if (ancestors.has(node.id))   chainRole = 'ancestor';
    else if (descendants.has(node.id)) chainRole = 'descendant';
    return { ...node, data: { ...node.data, chainRole } };
  });

  const edges = layoutResult.edges.map((edge) => {
    const inChain = chainSet.has(edge.source) && chainSet.has(edge.target);
    if (inChain) {
      return { ...edge, animated: false, style: { stroke: 'var(--primary)', opacity: 1 } };
    }
    return { ...edge, animated: false, style: { ...edge.style, opacity: 0.05 } };
  });

  return { nodes, edges };
}

function buildLayout(
  tasks: TaskRaw[],
  statusMap: Map<string, StatusEntry>,
  filteredIds: Set<string> | null,
  freshlyUnlocked: Set<string>,
  traderLevels: Record<string, number>,
  onToggle: (id: string) => void,
  onSelect: (task: TaskRaw) => void,
  onHover: (id: string | null) => void,
): { nodes: Node[]; edges: Edge[] } {
  const g = new graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const task of tasks) {
    g.setNode(task.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const task of tasks) {
    for (const req of task.taskRequirements) {
      if (g.hasNode(req.task.id)) g.setEdge(req.task.id, task.id);
    }
  }

  layout(g);

  const nodes: Node[] = tasks.map((task) => {
    const pos = g.node(task.id);
    const entry = statusMap.get(task.id) ?? { status: 'locked' as QuestNodeStatus };
    return {
      id: task.id,
      type: 'questNode',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        task,
        status: entry.status,
        lockReason: entry.lockReason,
        levelGap: entry.levelGap,
        dimmed: filteredIds !== null && !filteredIds.has(task.id),
        freshlyUnlocked: freshlyUnlocked.has(task.id),
        traderLevels,
        onToggle,
        onSelect,
        onHover,
      },
      style: { background: 'transparent', border: 'none', padding: 0, boxShadow: 'none' },
    };
  });

  const edges: Edge[] = [];
  for (const task of tasks) {
    for (const req of task.taskRequirements) {
      if (!g.hasNode(req.task.id)) continue;
      const src = statusMap.get(req.task.id)?.status ?? 'locked';
      const edgeProps =
        src === 'completed'
          ? { animated: false, style: { stroke: 'var(--color-lines-hover)', opacity: 0.4 } }
          : src === 'active'
          ? { animated: true, style: { stroke: 'var(--primary)', opacity: 1 } }
          : { animated: false, style: { stroke: 'var(--color-lines-hover)', opacity: 0.15 } };
      edges.push({
        id: `${req.task.id}->${task.id}`,
        source: req.task.id,
        target: task.id,
        type: 'smoothstep',
        ...edgeProps,
      });
    }
  }

  return { nodes, edges };
}

export default function QuestMapClient({ initialTasks }: Props) {
  const [selectedTask, setSelectedTask] = useState<TaskRaw | null>(null);
  const [filterKappa, setFilterKappa]   = useState(false);
  const [filterLK, setFilterLK]         = useState(false);
  const [selectedTraders, setSelectedTraders] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [freshlyUnlocked, setFreshlyUnlocked] = useState<Set<string>>(new Set());
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const completedQuests = useQuestStore((s) => s.completedQuests);
  const toggleQuest     = useQuestStore((s) => s.toggleQuest);

  const profiles      = usePlayerStore((s) => s.profiles);
  const activeId      = usePlayerStore((s) => s.activeProfileId);
  const activeProfile = profiles.find((p) => p.id === activeId);
  const playerLevel   = Number(activeProfile?.level ?? 1);
  const traderLevels  = activeProfile?.traderLevels ?? {};

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const task of initialTasks) {
      for (const req of task.taskRequirements) {
        const children = map.get(req.task.id) ?? [];
        children.push(task.id);
        map.set(req.task.id, children);
      }
    }
    return map;
  }, [initialTasks]);

  const ancestorMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    function getAncestors(id: string): Set<string> {
      if (map.has(id)) return map.get(id)!;
      const result = new Set<string>();
      const task = initialTasks.find((t) => t.id === id);
      if (!task) { map.set(id, result); return result; }
      for (const req of task.taskRequirements) {
        result.add(req.task.id);
        for (const a of getAncestors(req.task.id)) result.add(a);
      }
      map.set(id, result);
      return result;
    }
    for (const t of initialTasks) getAncestors(t.id);
    return map;
  }, [initialTasks]);

  const descendantMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    function getDescendants(id: string): Set<string> {
      if (map.has(id)) return map.get(id)!;
      const result = new Set<string>();
      for (const childId of (childrenMap.get(id) ?? [])) {
        result.add(childId);
        for (const d of getDescendants(childId)) result.add(d);
      }
      map.set(id, result);
      return result;
    }
    for (const t of initialTasks) getDescendants(t.id);
    return map;
  }, [initialTasks, childrenMap]);

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);

  const handleToggle = useCallback((taskId: string) => {
    const wasCompleted = completedQuests.includes(taskId);
    toggleQuest(taskId);

    if (!wasCompleted) {
      const candidateIds = childrenMap.get(taskId) ?? [];
      const newCompleted = new Set([...completedQuests, taskId]);
      const newlyActive = candidateIds.filter((childId) => {
        const childTask = initialTasks.find((t) => t.id === childId);
        if (!childTask) return false;
        const allPrereqsDone = childTask.taskRequirements.every((r) => newCompleted.has(r.task.id));
        const levelOk = playerLevel >= childTask.minPlayerLevel;
        return allPrereqsDone && levelOk;
      });

      if (newlyActive.length > 0) {
        setFreshlyUnlocked(new Set(newlyActive));
        setTimeout(() => setFreshlyUnlocked(new Set()), 4000);

        const targetNode = rfInstance?.getNode(newlyActive[0]);
        if (targetNode) {
          rfInstance?.setCenter(
            targetNode.position.x + 110,
            targetNode.position.y + 44,
            { zoom: 1.4, duration: 700 },
          );
        }

        if (newlyActive.length > 1) {
          setUnlockedCount(newlyActive.length);
          setTimeout(() => setUnlockedCount(0), 4000);
        }
      }
    }
  }, [completedQuests, toggleQuest, childrenMap, initialTasks, playerLevel, rfInstance]);

  const rawLayoutResult = useMemo(() => {
    const completedSet = new Set(completedQuests);
    const statusMap    = computeStatusMap(initialTasks, completedSet, playerLevel);
    const filteredIds  = computeFilteredIds(initialTasks, filterKappa, filterLK, selectedTraders);
    return buildLayout(initialTasks, statusMap, filteredIds, freshlyUnlocked, traderLevels, handleToggle, setSelectedTask, handleHover);
  }, [completedQuests, playerLevel, initialTasks, filterKappa, filterLK, selectedTraders, freshlyUnlocked, traderLevels, handleToggle, handleHover]);

  const { nodes, edges } = useMemo(
    () => applyChainHighlight(rawLayoutResult, hoveredId, ancestorMap, descendantMap),
    [rawLayoutResult, hoveredId, ancestorMap, descendantMap],
  );

  const handleTrader = (name: string) =>
    setSelectedTraders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const handleReset = () => {
    setFilterKappa(false);
    setFilterLK(false);
    setSelectedTraders(new Set());
  };

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    setRfInstance(instance);
    setTimeout(() => instance.fitView({ padding: 0.08, duration: 600 }), 120);
  }, []);

  useEffect(() => {
    if (rfInstance) {
      setTimeout(() => rfInstance.fitView({ padding: 0.08, duration: 400 }), 80);
    }
  }, [isFullscreen, rfInstance]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); return; }
        if (isFullscreen) setIsFullscreen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, searchOpen]);

  const handleFocusNode = useCallback((task: TaskRaw) => {
    const node = rfInstance?.getNode(task.id);
    if (node) {
      rfInstance?.setCenter(
        node.position.x + NODE_WIDTH / 2,
        node.position.y + NODE_HEIGHT / 2,
        { zoom: 1.5, duration: 500 },
      );
    }
  }, [rfInstance]);

  const { kappaTotal, kappaCompleted } = useMemo(() => {
    const completedSet = new Set(completedQuests);
    return {
      kappaTotal: initialTasks.filter((t) => t.kappaRequired).length,
      kappaCompleted: initialTasks.filter((t) => t.kappaRequired && completedSet.has(t.id)).length,
    };
  }, [initialTasks, completedQuests]);

  const containerCls = isFullscreen
    ? 'fixed inset-0 z-50 flex flex-col bg-(--color-base)'
    : 'flex flex-col w-full';

  const containerStyle = isFullscreen
    ? undefined
    : { height: 'calc(100dvh - 164px)', minHeight: 520 };

  return (
    <div className={containerCls} style={containerStyle}>
      <QuestFilterBar
        tasks={initialTasks}
        completedQuests={completedQuests}
        filterKappa={filterKappa}
        filterLK={filterLK}
        selectedTraders={selectedTraders}
        onKappa={() => setFilterKappa((v) => !v)}
        onLK={() => setFilterLK((v) => !v)}
        onTrader={handleTrader}
        onReset={handleReset}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((v) => !v)}
        searchOpen={searchOpen}
        onSearchOpen={() => setSearchOpen((v) => !v)}
      />

      <div className="relative flex-1 min-h-0">
        <QuestSearch
          tasks={initialTasks}
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onFocusNode={handleFocusNode}
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={handleInit}
          minZoom={0.05}
          maxZoom={1.5}
          panOnScroll
          panOnDrag
          zoomOnScroll={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          style={{ width: '100%', height: '100%' }}
        >
          <Background variant={BackgroundVariant.Dots} color="var(--color-lines-hover)" gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(node) => {
              const s = node.data?.status as QuestNodeStatus;
              if (s === 'completed') return '#6A8B5D';
              if (s === 'active') return 'var(--primary)';
              return 'rgba(255,255,255,0.08)';
            }}
            nodeBorderRadius={2}
            maskColor="rgba(0,0,0,0.7)"
            style={{
              background: 'var(--color-card-menu)',
              border: '1px solid var(--color-lines-hover)',
              bottom: 40,
              right: 16,
            }}
          />
        </ReactFlow>

        {unlockedCount > 1 && (
          <div className="absolute bottom-10 right-4 z-50 flex items-center gap-2 rounded-xs border border-(--primary)/40 bg-card-menu px-3 py-2">
            <span className="icon-bg icon-eft-quests-active w-3 h-3 shrink-0" />
            <span className="text-[10px] font-blender-medium uppercase text-(--primary)">
              Разблокировано: {unlockedCount} квестов
            </span>
          </div>
        )}

        {/* Status bar */}
        <div className="absolute bottom-0 left-0 right-0 z-10 h-8 flex items-center px-4 gap-4 border-t border-lines-hover bg-card-menu/80 backdrop-blur-sm pointer-events-none">
          <span className="text-[10px] font-blender-medium uppercase tracking-widest text-text-muted">
            Всего: <span className="text-text-primary">{initialTasks.length}</span>
          </span>
          <div className="w-px h-3.5 bg-lines-hover" />
          <span className="text-[10px] font-blender-medium uppercase tracking-widest text-text-muted">
            Выполнено: <span className="text-success">{completedQuests.length}</span>
          </span>
          <div className="w-px h-3.5 bg-lines-hover" />
          <span className="text-[10px] font-blender-medium uppercase tracking-widest text-text-muted">
            Каппа: <span className="text-text-primary">{kappaCompleted}/{kappaTotal}</span>
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="icon-bg icon-eft-profile-level w-3 h-3 text-text-muted" />
            <span className="text-[10px] font-blender-medium uppercase tracking-widest text-text-muted">
              {playerLevel} ЛВЛ.
            </span>
          </div>
        </div>
      </div>

      <QuestDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
