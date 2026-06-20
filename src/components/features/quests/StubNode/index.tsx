'use client';
import { memo } from 'react';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import type { TaskRaw } from '@/types/quest';

interface StubNodeProps {
  originalTask: TaskRaw;
  chainRole?: 'ancestor' | 'descendant' | 'self' | null;
  dimmed?: boolean;
  onFlyTo: (id: string, task: TaskRaw) => void;
}

interface CollapsedStubProps {
  count: number;
  onExpand: () => void;
}

export const StubNode = memo(function StubNode({ originalTask, chainRole, dimmed, onFlyTo }: StubNodeProps) {
  const traderColor = `var(${traderCssVar(originalTask.trader.normalizedName)})`;
  const opacity = dimmed ? 'opacity-20' : chainRole === 'descendant' ? 'opacity-100' : 'opacity-70';

  return (
    <button
      data-no-pan
      onClick={() => onFlyTo(originalTask.id, originalTask)}
      style={{
        width: 180,
        height: 52,
        borderColor: traderColor,
        boxShadow: chainRole === 'descendant'
          ? `0 0 8px color-mix(in srgb, ${traderColor} 50%, transparent)`
          : undefined,
      }}
      className={`flex items-center gap-2 px-3 rounded-xs border border-dashed bg-(--color-base) transition-all ${opacity} hover:opacity-100 shrink-0`}
    >
      <img
        src={traderImg(originalTask.trader.normalizedName)}
        width={20}
        height={20}
        className="rounded-xs shrink-0"
      />
      <span className="text-xs text-(--color-text-secondary) truncate flex-1 text-left leading-tight">
        {originalTask.trader.name.toUpperCase()}: {originalTask.name}
      </span>
      <span className="text-sm text-(--color-text-secondary) shrink-0">↗</span>
    </button>
  );
});

export const CollapsedStub = memo(function CollapsedStub({ count, onExpand }: CollapsedStubProps) {
  return (
    <button
      data-no-pan
      onClick={onExpand}
      style={{ width: 180, height: 52 }}
      className="flex items-center gap-2 px-3 rounded-xs border border-dashed border-(--color-border) bg-(--color-base) opacity-60 hover:opacity-100 transition-opacity shrink-0"
    >
      <span className="text-lg leading-none text-(--color-text-secondary)">···</span>
      <span className="text-xs text-(--color-text-secondary)">+ {count} задач</span>
    </button>
  );
});
