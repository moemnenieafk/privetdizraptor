import React from 'react';
import { Tooltip } from './Tooltip';

interface ItemGridSizeProps {
  width: number;
  height: number;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
  tooltip?: string;
}

export function ItemGridSize({ width, height, maxWidth, maxHeight, className = '', tooltip }: ItemGridSizeProps) {
  const cols = maxWidth !== undefined ? Math.max(maxWidth, width) : width;
  const rows = maxHeight !== undefined ? Math.max(maxHeight, height) : height;
  const totalCells = cols * rows;

  return (
    <Tooltip content={tooltip || `Размер: ${width}x${height}`} className={className}>
      <div className="flex items-center gap-2">
      <div
        className="inline-grid gap-px rounded bg-card-menu p-[2px] border border-lines-hover shadow-sm"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalCells }).map((_, i) => {
          const x = i % cols;
          const y = Math.floor(i / cols);
          const isFilled = x < width && y < height;
          
          return (
            <div
              key={i}
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[1px] transition-all duration-300 ${
                isFilled 
                  ? 'bg-linear-to-b from-lines-hover to-(--color-base) border border-lines-hover shadow-[inset_0_0_6px_rgba(0,0,0,0.8)]' 
                  : 'bg-(--color-base) border border-lines-hover opacity-40'
              }`}
            />
          );
        })}
      </div>
      <span className="font-mono text-xs text-text-muted">
        {width}x{height}
      </span>
      </div>
    </Tooltip>
  );
}