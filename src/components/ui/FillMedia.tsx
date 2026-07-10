'use client';

// Медиаконтейнер предмета с вертикальной заливкой-«баком» (паттерн модулей убежища).
// Опциональный интерактив: вертикальный ОТНОСИТЕЛЬНЫЙ драг с захватом указателя —
// тянешь пальцем по всему экрану (не только по иконке 53px), значение прилипает к
// круглым величинам под масштаб required. Тап без движения → onTap (напр. +1).
// Клавиатура: ↑/↓ ±1, PgUp/PgDn ±шаг, Home/End. children — оверлеи (FIR, −1, ссылка).
import { useCallback, useRef, useState } from 'react';
import { Check } from 'lucide-react';

interface FillMediaInteractive {
  value: number;
  max: number;
  onChange: (next: number) => void;
  /** Тап без перетаскивания (напр. +1 материал). Не задан → тап игнорируется. */
  onTap?: () => void;
}

interface FillMediaProps {
  imageSrc: string;
  alt: string;
  /** 0..100 — уровень заливки. */
  pct: number;
  done?: boolean;
  /** Если задан — контейнер становится вертикальным слайдером-баком. */
  interactive?: FillMediaInteractive;
  /** Доп. классы внешнего контейнера (напр. mx-auto). */
  className?: string;
  /** Доп. классы <img> (напр. hover-scale). */
  imgClassName?: string;
  imgLoading?: 'lazy' | 'eager';
  /** Оверлеи поверх медиа: FIR-бейдж, −1, ссылка на предмет. */
  children?: React.ReactNode;
}

const DRAG_RANGE = 200;    // px вертикального хода на полный диапазон
const MOVE_THRESHOLD = 4;  // px, после которых жест считается драгом, а не тапом

function niceStep(max: number): number {
  if (max <= 10) return 1;
  if (max <= 50) return 2;
  if (max <= 200) return 5;
  if (max <= 1000) return 25;
  if (max <= 2000) return 50;
  return 100;
}

function snap(value: number, max: number): number {
  const step = niceStep(max);
  const magnets = [0, max, max * 0.25, max * 0.5, max * 0.75];
  const tol = Math.max(step, max * 0.03);
  for (const m of magnets) {
    if (Math.abs(value - m) <= tol) return Math.round(m);
  }
  return Math.round(value / step) * step;
}

export function FillMedia({
  imageSrc,
  alt,
  pct,
  done = false,
  interactive,
  className,
  imgClassName,
  imgLoading,
  children,
}: FillMediaProps) {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startValue: number } | null>(null);
  const moved = useRef(false);

  const applyDelta = useCallback((clientY: number) => {
    if (!interactive || !drag.current) return;
    const dy = drag.current.startY - clientY; // вверх = прибавляем
    const raw = drag.current.startValue + (dy / DRAG_RANGE) * interactive.max;
    const clamped = Math.max(0, Math.min(interactive.max, raw));
    interactive.onChange(snap(clamped, interactive.max));
  }, [interactive]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startValue: interactive.value };
    moved.current = false;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !drag.current) return;
    if (Math.abs(e.clientY - drag.current.startY) > MOVE_THRESHOLD) moved.current = true;
    if (moved.current) applyDelta(e.clientY);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!moved.current) interactive?.onTap?.();
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const { value, max, onChange } = interactive;
    const step = niceStep(max);
    let next: number | null = null;
    if (e.key === 'ArrowUp') next = Math.min(max, value + 1);
    else if (e.key === 'ArrowDown') next = Math.max(0, value - 1);
    else if (e.key === 'PageUp') next = Math.min(max, value + step);
    else if (e.key === 'PageDown') next = Math.max(0, value - step);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = max;
    if (next !== null) { e.preventDefault(); onChange(next); }
  };

  const sliderProps = interactive
    ? {
        role: 'slider' as const,
        tabIndex: 0,
        'aria-label': 'Перетащите вертикально, чтобы заполнить',
        'aria-valuemin': 0,
        'aria-valuemax': interactive.max,
        'aria-valuenow': interactive.value,
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onKeyDown,
        style: { touchAction: 'none' as const },
      }
    : {};

  return (
    <div className={`relative h-13.25 w-13.25 shrink-0 ${className ?? ''}`}>
      <div
        {...sliderProps}
        className={`absolute inset-0 overflow-hidden rounded-sm border transition-colors ${interactive ? 'cursor-ns-resize focus:border-(--primary) focus:outline-none' : ''} ${dragging ? 'border-(--primary)' : 'border-lines-hover'}`}
      >
        <div className="absolute inset-0 bg-(--color-darkbase)" />
        <div
          className={`absolute inset-x-0 bottom-0 ${dragging ? '' : 'transition-[height] duration-300 ease-out'} ${done ? 'bg-success/35' : 'bg-(--primary)/30'}`}
          style={{ height: `${pct}%` }}
        />
        {interactive && pct > 0 && pct < 100 && (
          <div className={`absolute inset-x-0 h-px ${done ? 'bg-success' : 'bg-(--primary)'}`} style={{ bottom: `${pct}%` }} />
        )}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]" />
        <img
          src={imageSrc}
          alt={alt}
          loading={imgLoading}
          className={`pointer-events-none absolute inset-0 z-10 h-full w-full object-contain p-1 ${imgClassName ?? ''}`}
        />
      </div>

      {done && (
        <span className="absolute -right-1 -top-1 z-20 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-success text-(--color-base)">
          <Check className="h-3 w-3" />
        </span>
      )}

      {children}

      {dragging && interactive && (
        <span className="absolute -top-6 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-xs border border-(--primary)/50 bg-(--color-base) px-1.5 py-0.5 text-xs font-blender-medium tabular-nums text-(--primary)">
          {interactive.value} / {interactive.max}
        </span>
      )}
    </div>
  );
}
