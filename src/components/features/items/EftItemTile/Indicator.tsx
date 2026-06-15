"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { EftBarterData, EftCraftData, EftQuestData } from './types';
import { calcEftProfitLevel } from './types';
import { EftCraftTooltip } from './tooltips/CraftTooltip';
import { EftBarterTooltip } from './tooltips/BarterTooltip';
import { EftQuestTooltip } from './tooltips/QuestTooltip';

export type EftIndicatorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type EftIndicatorProps =
  | { type: 'barter'; data: EftBarterData; position?: EftIndicatorPosition }
  | { type: 'craft';  data: EftCraftData;  position?: EftIndicatorPosition }
  | { type: 'quest';  data: EftQuestData;  position?: EftIndicatorPosition };

const POSITION_CLASSES: Record<EftIndicatorPosition, string> = {
  'top-left':     'top-1.5 left-1.5',
  'top-right':    'top-1.5 right-1.5',
  'bottom-left':  'bottom-1.5 left-1.5',
  'bottom-right': 'bottom-1.5 right-1.5',
};

const ICON_CLASS: Record<'barter' | 'craft' | 'quest', string> = {
  barter: 'icon-eft-prog-barter',
  craft:  'icon-eft-prog-craft',
  quest:  'icon-eft-prog-items-needed',
};

const TOOLTIP_WIDTH = 256;
const GAP = 8;

function getIconColor(props: EftIndicatorProps): string {
  if (props.type === 'craft') {
    const level = calcEftProfitLevel(props.data.profit);
    return level === 'profitable' ? 'bg-nvg-green' : level === 'unprofitable' ? 'bg-red-400' : 'bg-amber-500';
  }
  if (props.type === 'barter') {
    const level = calcEftProfitLevel(props.data.profit);
    return level === 'profitable' ? 'bg-nvg-green' : level === 'unprofitable' ? 'bg-red-400' : 'bg-text-muted';
  }
  // quest
  return props.data.status === 'completed' ? 'bg-nvg-green' : props.data.status === 'in_progress' ? 'bg-yellow-500' : 'bg-amber-500';
}

function renderTooltip(props: EftIndicatorProps, style: React.CSSProperties) {
  if (props.type === 'craft')  return <EftCraftTooltip  data={props.data} style={style} />;
  if (props.type === 'barter') return <EftBarterTooltip data={props.data} style={style} />;
  return <EftQuestTooltip data={props.data} style={style} />;
}

export function EftIndicator(props: EftIndicatorProps) {
  const { type, position = 'top-right' } = props;
  const [visible, setVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleMouseEnter = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const left = rect.left - TOOLTIP_WIDTH - GAP >= GAP
      ? rect.left - TOOLTIP_WIDTH - GAP
      : rect.right + GAP;
    setTooltipStyle({ position: 'fixed', top: rect.top, left, zIndex: 9999 });
    setVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => setVisible(false), []);

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`absolute z-20 flex h-5 w-5 cursor-default items-center justify-center rounded-xs border border-lines-hover/50 bg-(--color-base)/80 backdrop-blur-sm ${POSITION_CLASSES[position]}`}
        title={type}
      >
        <span className={`${ICON_CLASS[type]} h-3 w-3 ${getIconColor(props)} mask-contain mask-center mask-no-repeat`} />
      </div>

      {mounted && visible && createPortal(
        <div className="pointer-events-none">
          {renderTooltip(props, tooltipStyle)}
        </div>,
        document.body
      )}
    </>
  );
}
