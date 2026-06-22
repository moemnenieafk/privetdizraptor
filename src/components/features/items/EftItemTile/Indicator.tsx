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

// glyph — цвет иконки по умолчанию; fill — заливка фона обёртки при наведении.
// Классы статические (не конкатенируются динамически), чтобы Tailwind JIT их собрал.
const STATE_STYLES = {
  green:  { glyph: 'bg-nvg-green',  fill: 'hover:bg-nvg-green' },
  red:    { glyph: 'bg-red-400',    fill: 'hover:bg-red-400' },
  amber:  { glyph: 'bg-amber-500',  fill: 'hover:bg-amber-500' },
  yellow: { glyph: 'bg-yellow-500', fill: 'hover:bg-yellow-500' },
  muted:  { glyph: 'bg-text-muted', fill: 'hover:bg-text-muted' },
} as const;

type IndicatorColorKey = keyof typeof STATE_STYLES;

function getIconColorKey(props: EftIndicatorProps, isPro: boolean): IndicatorColorKey {
  if (!isPro) return 'amber';
  if (props.type === 'craft') {
    const level = calcEftProfitLevel(props.data.profit);
    return level === 'profitable' ? 'green' : level === 'unprofitable' ? 'red' : 'amber';
  }
  if (props.type === 'barter') {
    const level = calcEftProfitLevel(props.data.profit);
    return level === 'profitable' ? 'green' : level === 'unprofitable' ? 'red' : 'muted';
  }
  if (props.type === 'quest') {
    if (props.data.type === 'unlock_trade') return 'muted';
    return props.data.status === 'completed' ? 'green' : props.data.status === 'in_progress' ? 'yellow' : 'amber';
  }
  return 'muted';
}

function renderTooltip(props: EftIndicatorProps) {
  if (props.type === 'craft')  return <EftCraftTooltip  data={props.data} />;
  if (props.type === 'barter') return <EftBarterTooltip data={props.data} />;
  if (props.type === 'quest')  return <EftQuestTooltip  data={props.data} />;
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
  const [hoverable, setHoverable] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    setHoverable(window.matchMedia('(pointer: fine)').matches);
  }, []);

  const clearTimers = useCallback(() => {
    if (openTimer.current)  { clearTimeout(openTimer.current);  openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // ESC to close
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVisible(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  const openAt = useCallback(() => {
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

  // Tap / click — always intercept so the surrounding tile <Link> never navigates.
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isArmorClass) return;
    clearTimers();
    if (visible) setVisible(false);
    else openAt();
  }, [isArmorClass, visible, openAt, clearTimers]);

  // Hover (pointer:fine): delayed open + grace close, bridged when cursor enters the tooltip.
  const handleIconEnter = useCallback(() => {
    if (!hoverable || isArmorClass) return;
    clearTimers();
    openTimer.current = setTimeout(openAt, 120);
  }, [hoverable, isArmorClass, openAt, clearTimers]);

  const handleIconLeave = useCallback(() => {
    if (!hoverable) return;
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = setTimeout(() => setVisible(false), 100);
  }, [hoverable]);

  const handleTooltipEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const handleTooltipLeave = useCallback(() => {
    if (!hoverable) return;
    closeTimer.current = setTimeout(() => setVisible(false), 100);
  }, [hoverable]);

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
  const { glyph, fill } = STATE_STYLES[getIconColorKey(props, isPro)];
  const tooltip = isPro ? renderTooltip(props) : <ProLockTooltip />;

  return (
    <>
      <div
        ref={ref}
        onClick={handleClick}
        onMouseEnter={handleIconEnter}
        onMouseLeave={handleIconLeave}
        className={`group/ind absolute z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded-xs transition-colors ${fill} ${POSITION_CLASSES[position]}`}
        title={props.type}
      >
        <span className={`${iconClass} h-4 w-4 ${glyph} transition-colors group-hover/ind:bg-(--color-darkbase) mask-contain mask-center mask-no-repeat`} />
      </div>

      {mounted && visible && tooltip && createPortal(
        <>
          {/* Backdrop only for tap/touch — hover closes on mouse-leave */}
          {!hoverable && (
            <div className="fixed inset-0 z-9998" onClick={() => setVisible(false)} />
          )}
          <div
            style={tooltipStyle}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
          >
            {tooltip}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
