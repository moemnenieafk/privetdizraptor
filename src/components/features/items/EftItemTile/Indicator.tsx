"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { EftBarterData, EftCraftData, EftQuestData } from './types';
import { calcEftProfitLevel } from './types';
import { EftCraftTooltip } from './tooltips/CraftTooltip';
import { EftBarterTooltip } from './tooltips/BarterTooltip';
import { EftQuestTooltip } from './tooltips/QuestTooltip';
import { ProLockTooltip } from './tooltips/ProLockTooltip';
import { usePlayerStore } from '@/store/usePlayerStore';

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

function getIconColor(props: EftIndicatorProps, isPro: boolean): string {
  if (!isPro) return 'bg-amber-500';
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

  const edition = usePlayerStore(s =>
    s.profiles.find(p => p.id === s.activeProfileId)?.edition ?? 'Standard'
  );
  const isPro = edition === 'TUE' || edition === 'EOD';

  const [visible, setVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ESC to close
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVisible(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isArmorClass || !ref.current) return;
    if (visible) { setVisible(false); return; }
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
  }, [isArmorClass, visible]);

  if (isArmorClass) {
    const cls = `icon-eft-armor-class-${props.armorClass}`;
    return (
      <div className={`absolute z-20 flex h-6 w-6 items-center justify-center ${POSITION_CLASSES[position]}`}>
        <span className={`${cls} h-4 w-4 bg-text-secondary mask-contain mask-center mask-no-repeat`} />
      </div>
    );
  }

  const narrowedProps = props as Extract<EftIndicatorProps, { type: 'barter' | 'craft' | 'quest' }>;
  const iconClass = ICON_CLASS[narrowedProps.type];
  const iconColor = getIconColor(props, isPro);
  const tooltip = isPro
    ? renderTooltip(props, tooltipStyle)
    : <ProLockTooltip style={tooltipStyle} />;

  return (
    <>
      <div
        ref={ref}
        onClick={handleClick}
        className={`absolute z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded-xs border border-lines-hover/50 bg-(--color-base)/80 backdrop-blur-sm ${POSITION_CLASSES[position]}`}
        title={props.type}
      >
        <span className={`${iconClass} h-4 w-4 ${iconColor} mask-contain mask-center mask-no-repeat`} />
      </div>

      {mounted && visible && tooltip && createPortal(
        <>
          <div
            className="fixed inset-0 z-9998"
            onClick={() => setVisible(false)}
          />
          <div style={{ zIndex: 9999, position: 'relative' }}>
            {tooltip}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
