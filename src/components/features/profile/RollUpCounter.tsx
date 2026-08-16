'use client';

import { useEffect, useRef, useState } from 'react';

// Счётчик-одометр: rAF-твин от предыдущего значения к новому (§3.3 моушен). Числа —
// font-blender-medium tabular-nums (font-mono ЗАПРЕЩЁН, §6). value=null → «—» (пустое поле,
// §4.5): нет данных = следующий шаг/прочерк, а не «0».

interface RollUpCounterProps {
  /** Целевое значение. null — данных нет (рендерим placeholder). */
  value: number | null;
  /** Длительность твина, мс. */
  durationMs?: number;
  /** Форматтер (напр. проценты/₽). По умолчанию — целое с разделителями. */
  format?: (n: number) => string;
  /** Плейсхолдер при value=null. */
  placeholder?: string;
  className?: string;
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString('ru-RU');

export function RollUpCounter({
  value,
  durationMs = 900,
  format = defaultFormat,
  placeholder = '—',
  className = '',
}: RollUpCounterProps) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value == null) return;
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — быстрый старт, мягкая посадка.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return (
    <span className={`font-blender-medium tabular-nums tracking-wider ${className}`}>
      {value == null ? placeholder : format(display)}
    </span>
  );
}
