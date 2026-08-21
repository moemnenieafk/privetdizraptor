'use client';

// Карта сюжетных квестов — ПЕРЕИСПОЛЬЗУЕТ ноды большой карты квестов (решение V4DYA:
// «в фигме переиспользовал ноды из карты квестов, просто ставил по центру»):
//  - узлы = настоящий <QuestNode> (псевдо-TaskRaw из данных графа; шапка — фото
//    трейдера или иконка-маска через headerIconClass; пин скрыт);
//  - вьюпорт = QuestMapViewport, линии = makeQuestPath (общие с /eft/questmap);
//  - цвет узлов истории — псевдо-трейдер --trader-<slug> (Борей: стальной #80ACBF);
//  - чеки «ВЫПОЛНЕНО?» — useStoryProgressStore (активация = ключи шага 01 гайда),
//    убежище авто-чекается из useHideoutStore; счётчики предметов в строках целей
//    живут в useQuestStore.itemProgress под псевдо-id (синкается в облако).
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Plus, Minus } from 'lucide-react';
import {
  QuestMapViewport,
  type QuestMapViewportRef,
  type ConnectionDef,
} from '@/components/features/quests/QuestMapViewport';
import { QuestNode } from '@/components/features/quests/QuestNode';
import { makeQuestPath } from '@/lib/quest-path';
import { useStoryProgressStore } from '@/store/useStoryProgressStore';
import { useHideoutStore } from '@/store/useHideoutStore';
import { itemIconUrl } from '@/lib/item-icon';
import type { TaskRaw, TaskObjective, QuestNodeData } from '@/types/quest';
import type { StoryQuestMapData, StoryMapNodeData } from '@/data/story-walkthroughs/boreas-map';

const NODE_W = 348;

// Иконка задачи → тип TaskObjectiveBasic (обратный маппинг getObjectiveIcon из QuestNode).
function basicTypeFor(icon: string): string {
  if (icon.includes('visit')) return 'visit';
  if (icon.includes('modify')) return 'buildWeapon';
  if (icon.includes('survive')) return 'survive';
  if (icon.includes('eliminate')) return 'shoot';
  return 'findQuestItem';
}

// Иконка-маска шапки для не-трейдерских узлов.
function headerIconFor(n: StoryMapNodeData): string | undefined {
  if (n.traderPhoto) return undefined; // трейдер — фото по normalizedName
  if (n.mapIcon) return n.mapIcon;
  if (n.kind === 'hideout') return 'icon-eft-prog-hideout';
  return n.iconClass;
}

// normalizedName для цвета узла: трейдер — свой, системные — псевдо-трейдер истории.
function traderNnFor(n: StoryMapNodeData, storySlug: string): { name: string; normalizedName: string } {
  if (n.traderPhoto) {
    const m = n.traderPhoto.match(/\/([a-z]+)\.webp$/);
    return { name: n.title, normalizedName: m?.[1] ?? storySlug };
  }
  return { name: n.title, normalizedName: storySlug };
}

// Узел графа → псевдо-TaskRaw для QuestNode.
function toPseudoTask(n: StoryMapNodeData, storySlug: string): TaskRaw {
  const objectives: TaskObjective[] = [];

  if (n.build) {
    objectives.push({
      id: `${n.id}-build`,
      __typename: 'TaskObjectiveBasic',
      type: 'findQuestItem',
      description: `Постройка: ${n.build.name}, Уровень ${n.build.level}`,
    } as TaskObjective);
  }
  for (const [i, t] of (n.tasks ?? []).entries()) {
    objectives.push({
      id: `${n.id}-t${i}`,
      __typename: 'TaskObjectiveBasic',
      type: basicTypeFor(t.icon),
      description: t.count != null ? `${t.text} (0/${t.count})` : t.text,
    } as TaskObjective);
  }
  if (n.item) {
    objectives.push({
      id: `${n.id}-item`,
      __typename: 'TaskObjectiveItem',
      type: 'giveItem',
      description: n.item.name,
      item: {
        id: n.item.id || n.id,
        name: n.item.name,
        shortName: n.item.name,
        image512pxLink: n.item.id ? itemIconUrl(n.item.id) : '/images/placeholder.webp',
      },
      count: n.item.count,
      foundInRaid: Boolean(n.item.loot),
    } as TaskObjective);
  }

  return {
    id: `sb-${storySlug}-${n.id}`,
    name: n.title,
    normalizedName: `sb-${storySlug}-${n.id}`,
    kappaRequired: false,
    lightkeeperRequired: false,
    minPlayerLevel: 0,
    experience: 0,
    trader: { ...traderNnFor(n, storySlug), imageLink: n.traderPhoto },
    taskRequirements: [],
    objectives,
    finishRewards: { items: [], traderStanding: [] },
  } as unknown as TaskRaw;
}

// Оценка высоты узла (для точек привязки линий): шапка+заголовок+цели+футер.
function nodeHeight(n: StoryMapNodeData): number {
  let h = 60 + 34 + 64; // header + h3 + footer
  const objs = (n.build ? 1 : 0) + (n.tasks?.length ?? 0) + (n.item ? 1 : 0);
  h += objs * 44;
  return h;
}

// ─── Карта ────────────────────────────────────────────────────────────────────
export function StoryQuestMap({ map }: { map: StoryQuestMapData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const viewportRef = useRef<QuestMapViewportRef>(null);
  const conditionDone = useStoryProgressStore((s) => s.conditionDone);
  const toggleCondition = useStoryProgressStore((s) => s.toggleCondition);
  const levels = useHideoutStore((s) => s.levels);

  const isAuto = useCallback(
    (n: StoryMapNodeData) =>
      n.kind === 'hideout' && n.build
        ? (mounted ? (levels[n.build.normalizedName] ?? 0) : 0) >= n.build.level
        : false,
    [levels, mounted],
  );
  const isDone = useCallback(
    (n: StoryMapNodeData) =>
      isAuto(n) || (mounted && Boolean(n.conditionKey && conditionDone[n.conditionKey])),
    [isAuto, mounted, conditionDone],
  );

  const nodeById = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map.nodes]);
  const pseudoTasks = useMemo(
    () => new Map(map.nodes.map((n) => [n.id, toPseudoTask(n, map.slug)])),
    [map.nodes, map.slug],
  );

  const noop = useCallback(() => {}, []);
  const noopHover = useCallback((_: string | null) => {}, []);
  const noopSelect = useCallback((_: TaskRaw) => {}, []);

  // Линии: фирменный makeQuestPath; от выполненных узлов — nvg-green (как на questmap).
  const connections = useMemo<ConnectionDef[]>(
    () =>
      map.edges.flatMap((e) => {
        const src = nodeById.get(e.from);
        const tgt = nodeById.get(e.to);
        if (!src || !tgt) return [];
        const srcDone = isDone(src);
        return [
          {
            id: `${e.from}->${e.to}`,
            d: makeQuestPath(src.x + NODE_W / 2, src.y + nodeHeight(src), tgt.x + NODE_W / 2, tgt.y),
            stroke: srcDone ? 'var(--color-nvg-green)' : `var(--trader-${map.slug})`,
            opacity: srcDone ? 0.35 : 0.8,
            strokeWidth: 2,
            nodeIds: [e.from, e.to] as [string, string],
          },
        ];
      }),
    [map.edges, nodeById, isDone, map.slug],
  );

  // Стартовый вид: весь граф в кадре.
  useEffect(() => {
    if (!mounted) return;
    const xs = map.nodes.map((n) => n.x);
    const ys = map.nodes.map((n) => n.y);
    viewportRef.current?.fitToBounds(
      {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs) + NODE_W,
        maxY: Math.max(...ys) + 340,
      },
      { padding: 60, duration: 0 },
    );
  }, [mounted, map.nodes]);

  return (
    <div className="relative h-[75vh] w-full overflow-hidden rounded-lg border border-lines-hover bg-(--color-darkbase)">
      <QuestMapViewport ref={viewportRef} connections={connections} className="h-full w-full">
        {map.nodes.map((n) => {
          const task = pseudoTasks.get(n.id)!;
          const data: QuestNodeData = {
            task,
            status: isDone(n) ? 'completed' : 'active',
            pinned: false,
            hidePin: true,
            headerIconClass: headerIconFor(n),
            onToggle: () => n.conditionKey && toggleCondition(n.conditionKey),
            onSelect: noopSelect,
            onHover: noopHover,
            onPin: noop,
          };
          return (
            <div key={n.id} className="absolute" style={{ left: n.x, top: n.y }}>
              <QuestNode data={data} />
            </div>
          );
        })}
      </QuestMapViewport>

      {/* Зум-кнопки (как на общей карте) */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1">
        <button
          type="button"
          aria-label="Приблизить"
          onClick={() => viewportRef.current?.zoomIn()}
          className="flex h-11 w-11 lg:h-9 lg:w-9 items-center justify-center rounded border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Отдалить"
          onClick={() => viewportRef.current?.zoomOut()}
          className="flex h-11 w-11 lg:h-9 lg:w-9 items-center justify-center rounded border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
