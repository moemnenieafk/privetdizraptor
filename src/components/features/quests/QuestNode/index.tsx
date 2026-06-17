'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { QuestNodeData, QuestNodeStatus, QuestLockReason } from '@/types/quest';
import { useQuestStore } from '@/store/useQuestStore';

const TRADER_SLUG: Record<string, string> = {
  'btr-driver': 'btrdriver',
};
const traderImg = (n: string) => `/images/traders/eft/${TRADER_SLUG[n] ?? n}.webp`;

const STATUS_CARD_BASE: Record<QuestNodeStatus, string> = {
  locked:
    'bg-(--color-darkbase) border border-dashed border-(--color-lines-hover) text-(--color-text-muted)',
  active:
    'bg-(--color-card-menu) border border-(--primary) text-(--color-text-primary) shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_25%,transparent)]',
  completed: 'bg-[#182216] border border-[#6A8B5D] text-[#739964] opacity-70',
};

const STATUS_BTN: Record<QuestNodeStatus, string> = {
  locked:    'cursor-not-allowed opacity-50',
  active:    'bg-(--primary)/10 text-(--primary) hover:bg-(--primary)/20',
  completed: 'bg-(--color-lines-hover)/50 text-(--color-text-muted) hover:text-(--color-text-primary)',
};

const BTN_LABEL: Record<QuestNodeStatus, string> = {
  locked:    'ЗАБЛОКИРОВАНО',
  active:    'ВЫПОЛНЕНО?',
  completed: '✓ ВЫПОЛНЕНО',
};

function getOpacityCls(
  status: QuestNodeStatus,
  lockReason?: QuestLockReason,
  chainRole?: 'ancestor' | 'descendant' | 'self' | null,
): string {
  if (chainRole === null) return 'opacity-30';
  if (status === 'locked') {
    if (lockReason === 'level') return 'opacity-80';
    if (lockReason === 'both') return 'opacity-50';
    return 'opacity-60';
  }
  return '';
}

function QuestNodeComponent({ data }: NodeProps<QuestNodeData>) {
  const { task, status, lockReason, levelGap, dimmed, freshlyUnlocked, traderLevels, chainRole, onToggle, onSelect, onHover } = data;

  const taskItemProgress = useQuestStore((s) => s.itemProgress[task.id]);

  const itemObjs = task.objectives.filter((o) => o.__typename === 'TaskObjectiveItem');
  const hasItemObjectives = status === 'active' && itemObjs.length > 0;
  const totalNeeded = itemObjs.reduce((sum, o) => sum + (o.count ?? 1), 0);
  const totalFound  = itemObjs.reduce((sum, o) => sum + Math.min(o.count ?? 1, taskItemProgress?.[o.id] ?? 0), 0);
  const itemCompletionPct = hasItemObjectives && totalNeeded > 0 ? (totalFound / totalNeeded) * 100 : 0;

  const unmetTraderObjs = task.objectives.filter((o) => {
    if (o.__typename !== 'TaskObjectiveTraderLevel') return false;
    const tName = o.trader?.normalizedName;
    if (!tName || !o.level) return false;
    return (traderLevels?.[tName] ?? 0) < o.level;
  });

  const showLevelBadge = (lockReason === 'level' || lockReason === 'both') && task.minPlayerLevel > 0;
  const showTraderBadge = status === 'locked' && unmetTraderObjs.length > 0;
  const firstTraderObj = unmetTraderObjs[0];

  const cardCls = [
    'relative w-55 min-h-22 rounded-xs flex flex-col p-2 cursor-pointer transition-all duration-150',
    STATUS_CARD_BASE[status],
    getOpacityCls(status, lockReason, chainRole),
    freshlyUnlocked ? 'animate-[fresh-unlock_0.6s_ease-out]' : '',
    chainRole === 'self'       ? 'ring-2 ring-(--primary)' : '',
    chainRole === 'ancestor'   ? 'ring-1 ring-sky-500/60' : '',
    chainRole === 'descendant' ? 'ring-1 ring-(--primary)/60' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={dimmed ? 'pointer-events-none opacity-20 grayscale' : undefined}>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />

      <div
        className={cardCls}
        onClick={() => onSelect(task)}
        onMouseEnter={() => onHover(task.id)}
        onMouseLeave={() => onHover(null)}
      >
        {freshlyUnlocked && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 text-[8px] font-blender-medium uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-(--primary) text-(--color-base) animate-pulse whitespace-nowrap">
            НОВЫЙ
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <img
            src={traderImg(task.trader.normalizedName)}
            alt={task.trader.name}
            width={20}
            height={20}
            className="shrink-0 rounded-xs"
          />
          <span className="text-[10px] font-blender-medium uppercase tracking-widest text-text-muted truncate flex-1">
            {task.trader.name}
          </span>
          <div className="flex items-center gap-0.5 shrink-0">
            {task.kappaRequired && (
              <span className="icon-bg icon-eft-profile-kappa w-3.5 h-3.5" />
            )}
            {task.lightkeeperRequired && (
              <span className="icon-bg icon-eft-profile-lightkeeper w-3.5 h-3.5" />
            )}
          </div>
        </div>

        <span className="text-[11px] font-blender-medium uppercase leading-tight mt-1 mb-auto">
          {task.name}
        </span>

        <button
          className={`nodrag h-6 w-full text-[9px] font-blender-medium uppercase tracking-wider rounded-xs mt-1 transition-colors duration-150 ${STATUS_BTN[status]}`}
          disabled={status === 'locked'}
          onClick={(e) => {
            e.stopPropagation();
            if (status !== 'locked') onToggle(task.id);
          }}
        >
          {BTN_LABEL[status]}
        </button>

        {/* Mini progress bar — item objectives */}
        {hasItemObjectives && (
          <div className="h-0.5 w-full bg-lines-hover rounded-full mt-1">
            <div
              className="h-full rounded-full bg-(--primary)/60 transition-all duration-300"
              style={{ width: `${itemCompletionPct}%` }}
            />
          </div>
        )}

        {/* Level Badge */}
        {showLevelBadge && (
          <div className={`absolute bottom-1 right-1 flex items-center gap-0.5 rounded-xs px-1 py-0.5 ${
            (levelGap ?? 0) <= 5
              ? 'bg-(--primary)/15 border border-(--primary)/40 text-(--primary)'
              : 'bg-lines-hover text-text-muted'
          }`}>
            <span className="icon-bg icon-eft-profile-level w-2.5 h-2.5" />
            <span className="text-[9px] font-blender-medium uppercase">ЛВЛ. {task.minPlayerLevel}</span>
          </div>
        )}

        {/* Trader Level Badge */}
        {showTraderBadge && firstTraderObj?.trader && (
          <div className={`absolute bottom-1 flex items-center gap-0.5 rounded-xs px-1 py-0.5 ${
            showLevelBadge ? 'right-18' : 'right-1'
          } ${
            (levelGap ?? 0) <= 5
              ? 'bg-(--primary)/15 border border-(--primary)/40 text-(--primary)'
              : 'bg-lines-hover text-text-muted'
          }`}>
            <img
              src={traderImg(firstTraderObj.trader.normalizedName)}
              alt={firstTraderObj.trader.name}
              width={12}
              height={12}
              className="rounded-[1px] shrink-0"
            />
            <span className="text-[9px] font-blender-medium uppercase">ЛВЛ. {firstTraderObj.level}</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  );
}

export const QuestNode = memo(QuestNodeComponent);
