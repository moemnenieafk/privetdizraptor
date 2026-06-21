"use client";

import type { EftQuestData, EftQuestStatus } from '../types';
import { getTraderPortraitPath } from '@/lib/item-indicators.util';

const STATUS_LABEL: Record<EftQuestStatus, string> = {
  not_started: 'ЗАДАНИЕ НЕ ВЫПОЛНЕНО',
  in_progress:  'В ПРОЦЕССЕ ВЫПОЛНЕНИЯ...',
  completed:    'ЗАДАНИЕ ВЫПОЛНЕНО',
};

const STATUS_TEXT: Record<EftQuestStatus, string> = {
  not_started: 'text-red-400',
  in_progress:  'text-yellow-500',
  completed:    'text-nvg-green',
};

const STATUS_BORDER: Record<EftQuestStatus, string> = {
  not_started: 'border-red-500/50',
  in_progress:  'border-yellow-500/50',
  completed:    'border-nvg-green/50',
};

interface EftQuestTooltipProps {
  data: EftQuestData;
  style?: React.CSSProperties;
}

export function EftQuestTooltip({ data, style }: EftQuestTooltipProps) {
  const isTaskProgress = data.type === 'task_progress';
  const headerLabel = isTaskProgress ? 'ЛЮБИМОЕ ЗАДАНИЕ' : 'ТРЕБУЕТСЯ ПО ЗАДАНИЮ';

  const npcPortraitSrc = data.npcImageLink ?? getTraderPortraitPath(data.npcName) ?? undefined;
  const traderPortraitSrc = data.type === 'unlock_trade'
    ? (data.traderImageLink ?? getTraderPortraitPath(data.traderName) ?? undefined)
    : undefined;

  return (
    <div
      className={`w-64 rounded-sm border ${STATUS_BORDER[data.status]} bg-card-menu p-3 shadow-xl`}
      style={style}
    >
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="icon-eft-prog-items-needed h-3 w-3 bg-amber-500 mask-contain mask-center mask-no-repeat" />
          <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
            {headerLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {npcPortraitSrc && (
             
            <img src={npcPortraitSrc} alt={data.npcName} className="h-5 w-5 rounded-xs object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          )}
          {traderPortraitSrc && (
             
            <img src={traderPortraitSrc} alt={data.type === 'unlock_trade' ? data.traderName : ''} className="h-5 w-5 rounded-xs object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          )}
        </div>
      </div>

      {/* Quest card */}
      <div className="mb-2.5 flex items-center gap-2 rounded-xs border border-lines-hover/30 bg-(--color-base) p-1.5">
        {data.questImageLink && (
           
          <img
            src={data.questImageLink}
            alt={data.questName}
            className="h-10 w-10 shrink-0 rounded-xs border border-lines-hover/30 object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <span className="font-blender-medium text-type-caption leading-tight text-text-primary">{data.questName}</span>
      </div>

      {/* Body */}
      {isTaskProgress ? (
        <div className="mb-2.5 flex flex-col gap-1">
          <p className="font-blender-book text-type-caption leading-snug text-text-secondary">{data.description}</p>
          <span className="font-blender-medium text-type-caption text-text-muted">{data.progress}</span>
        </div>
      ) : (
        <div className="mb-2.5 flex flex-col gap-1">
          {data.objectives.map((obj, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span
                className={`icon-eft-quests-loot mt-px h-3 w-3 shrink-0 mask-contain mask-center mask-no-repeat ${
                  obj.completed ? 'bg-nvg-green' : 'bg-text-muted'
                }`}
              />
              <span
                className={`font-blender-book text-type-caption leading-snug ${
                  obj.completed ? 'text-text-muted line-through' : 'text-text-secondary'
                }`}
              >
                {obj.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Status footer */}
      <div className="border-t border-lines-hover/50 pt-2 text-center">
        <span className={`font-blender-medium text-type-caption uppercase tracking-widest ${STATUS_TEXT[data.status]}`}>
          {STATUS_LABEL[data.status]}
        </span>
      </div>
    </div>
  );
}
