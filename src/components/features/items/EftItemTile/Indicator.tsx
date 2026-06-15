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
  | { type: 'barter';      data: EftBarterData; position?: EftIndicatorPosition }
  | { type: 'craft';       data: EftCraftData;  position?: EftIndicatorPosition }
  | { type: 'quest';       data: EftQuestData;  position?: EftIndicatorPosition }
  | { type: 'armor-class'; armorClass: number;  position?: EftIndicatorPosition };

const POSITION_CLASSES: Record<EftIndicatorPosition, string> = {
  'top-left':     'top-2 left-2',
  'top-right':    'top-2 right-2',
  'bottom-left':  'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
};

const ICON_CLASS: Record<'barter' | 'craft' | 'quest', string> = {
  barter: 'icon-eft-prog-barter',
  craft:  'icon-eft-prog-craft',
  quest:  'icon-eft-quests-side',
};

const TOOLTIP_WIDTH = 256;
const TOOLTIP_MAX_HEIGHT = 320;
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
  if (props.type === 'quest') {
    if (props.data.type === 'unlock_trade') return 'bg-text-muted';
    return props.data.status === 'completed' ? 'bg-nvg-green' : props.data.status === 'in_progress' ? 'bg-yellow-500' : 'bg-amber-500';
  }
  return 'bg-text-muted';
}

function renderTooltip(props: EftIndicatorProps, style: React.CSSProperties) {
  if (props.type === 'craft')  return <EftCraftTooltip  data={props.data} style={style} />;
  if (props.type === 'barter') return <EftBarterTooltip data={props.data} style={style} />;
  if (props.type === 'quest')  return <EftQuestTooltip  data={props.data} style={style} />;
  return null;
}

export function EftIndicator(props: EftIndicatorProps) {
  const isArmorClass = props.type === 'armor-class';
  const position = props.position ?? (isArmorClass ? 'bottom-left' : 'top-right');

  const [visible, setVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  // Debounce hide so scale/transition jitter doesn't close the tooltip prematurely
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (isArmorClass || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rawLeft = rect.left - TOOLTIP_WIDTH - GAP >= GAP
      ? rect.left - TOOLTIP_WIDTH - GAP
      : rect.right + GAP;
    const left = Math.max(GAP, Math.min(rawLeft, vw - TOOLTIP_WIDTH - GAP));
    const top  = Math.max(GAP, Math.min(rect.top, vh - TOOLTIP_MAX_HEIGHT - GAP));
    setTooltipStyle({ position: 'fixed', top, left, zIndex: 9999 });
    setVisible(true);
  }, [isArmorClass]);

  const handleMouseLeave = useCallback(() => {
    hideTimer.current = setTimeout(() => setVisible(false), 80);
  }, []);

  if (props.type === 'armor-class') {
    const cls = `icon-eft-armor-class-${props.armorClass}`;
    return (
      <div className={`absolute z-20 flex h-6 w-6 items-center justify-center ${POSITION_CLASSES[position]}`}>
        <span className={`${cls} h-4 w-4 bg-text-secondary mask-contain mask-center mask-no-repeat`} />
      </div>
    );
  }

  // After the armor-class early return, TS narrows props.type to 'barter' | 'craft' | 'quest'
  const narrowedProps = props as Extract<EftIndicatorProps, { type: 'barter' | 'craft' | 'quest' }>;
  const iconClass = ICON_CLASS[narrowedProps.type];
  const iconColor = getIconColor(props);
  const tooltip = renderTooltip(props, tooltipStyle);

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`absolute z-20 flex h-6 w-6 cursor-default items-center justify-center rounded-xs border border-lines-hover/50 bg-(--color-base)/80 backdrop-blur-sm ${POSITION_CLASSES[position]}`}
        title={props.type}
      >
        <span className={`${iconClass} h-4 w-4 ${iconColor} mask-contain mask-center mask-no-repeat`} />
      </div>

      {mounted && visible && tooltip && createPortal(
        <div className="pointer-events-none">
          {tooltip}
        </div>,
        document.body
      )}
    </>
  );
}
