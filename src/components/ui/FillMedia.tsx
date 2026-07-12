'use client';

// Медиаконтейнер предмета с вертикальной заливкой-«баком» (паттерн модулей убежища).
// Драг-залив убран: на больших required (напр. 4500 патронов) вертикальный жест
// физически не давал точности лучше сотни и конфликтовал с дрожанием пальца.
// Точный ввод живёт в QtyControl (инпут + удержание + Макс/Сброс), здесь — только
// индикация и опциональный тап (напр. +1 материал).
import { Check } from 'lucide-react';

interface FillMediaProps {
  imageSrc: string;
  alt: string;
  /** 0..100 — уровень заливки. */
  pct: number;
  done?: boolean;
  /** Если задан — контейнер кликабелен (напр. +1 материал). Иначе чистая индикация. */
  onTap?: () => void;
  /** Подсказка для кликабельного бака. */
  tapTitle?: string;
  /** Доп. классы внешнего контейнера (напр. mx-auto). */
  className?: string;
  /** Доп. классы <img> (напр. hover-scale). */
  imgClassName?: string;
  imgLoading?: 'lazy' | 'eager';
  /** Оверлеи поверх медиа: FIR-бейдж, −1, ссылка на предмет. */
  children?: React.ReactNode;
}

export function FillMedia({
  imageSrc,
  alt,
  pct,
  done = false,
  onTap,
  tapTitle,
  className,
  imgClassName,
  imgLoading,
  children,
}: FillMediaProps) {
  const tapProps = onTap
    ? {
        role: 'button' as const,
        tabIndex: 0,
        title: tapTitle,
        onClick: onTap,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTap();
          }
        },
      }
    : {};

  return (
    <div className={`relative h-13.25 w-13.25 shrink-0 ${className ?? ''}`}>
      <div
        {...tapProps}
        className={`absolute inset-0 select-none overflow-hidden rounded-sm border border-lines-hover ${
          onTap ? 'cursor-pointer transition-colors hover:border-(--primary) focus:border-(--primary) focus:outline-none' : ''
        }`}
      >
        <div className="absolute inset-0 bg-(--color-darkbase)" />
        <div
          className={`absolute inset-x-0 bottom-0 transition-[height] duration-300 ease-out ${done ? 'bg-success/35' : 'bg-(--primary)/30'}`}
          style={{ height: `${pct}%` }}
        />
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
    </div>
  );
}
