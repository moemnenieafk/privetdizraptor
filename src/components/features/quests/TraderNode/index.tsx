'use client';

import { memo } from 'react';
import { traderImg, traderCssVar } from '@/lib/trader-utils';

export interface TraderNodeData {
  traderName:     string;
  normalizedName: string;
  color:          string;
  dimmed?:        boolean;
  chainRole?:     'ancestor' | 'descendant' | 'self' | null;
}

function TraderNodeComponent({ data }: { data: TraderNodeData }) {
  const { traderName, normalizedName, color, dimmed, chainRole } = data;

  const traderColor = `var(${traderCssVar(normalizedName)})`;

  const wrapCls = [
    'transition-opacity duration-150',
    dimmed            ? 'opacity-20 grayscale pointer-events-none'
    : chainRole === null ? 'opacity-30'
    : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapCls}>
      <div
        className="p-1 rounded-xs overflow-hidden"
        style={{
          width:      168,
          height:     196,
          background: color,
          boxShadow: [
            `0 0 0 1px color-mix(in srgb, ${traderColor} 40%, transparent)`,
            `0 0 16px color-mix(in srgb, ${traderColor} 20%, transparent)`,
          ].join(', '),
        }}
      >
        {/* Title band: 160×28 */}
        <div
          className="flex items-center justify-center"
          style={{ height: 28, backgroundColor: color }}
        >
          <span
            className="font-blender-medium uppercase leading-none tracking-widest text-white truncate px-1"
            style={{ fontSize: 18 }}
          >
            {traderName}
          </span>
        </div>

        {/* Portrait: 160×160 */}
        <img
          src={traderImg(normalizedName)}
          alt={traderName}
          width={160}
          height={160}
          className="block object-cover object-top"
          style={{ width: 160, height: 160 }}
        />
      </div>
    </div>
  );
}

export const TraderNode = memo(TraderNodeComponent);
