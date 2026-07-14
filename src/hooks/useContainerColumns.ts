"use client";

import { useState, useEffect, useRef, type RefObject } from "react";

export interface ColumnStep {
  /** Минимальная ширина КОНТЕЙНЕРА (px), с которой действует это число колонок. */
  minWidth: number;
  columns: number;
}

/**
 * Возвращает число колонок сетки на основе ширины САМОГО контейнера, а не вьюпорта.
 *
 * Меряет переданный элемент через `ResizeObserver`, поэтому сетка ведёт себя одинаково
 * в любом слоте (главная колонка, сайдбар, `CompareDrawer`, сплит-вью) — в отличие от
 * `window.innerWidth`, который знает только про вьюпорт и разъезжается с реальным
 * контейнером. Это единый источник правды для виртуализированных сеток: тем же числом
 * колонок кормится и виртуализатор (расчёт строк), и `grid-template-columns`.
 *
 * Для НЕвиртуализированного рефлоу используй нативные контейнер-запросы Tailwind v4
 * (`@container` на каркасе + варианты `@sm:` / `@md:` / `@min-[Npx]:` на детях) —
 * без JS. Этот хук нужен только там, где число колонок обязано быть известно в JS.
 *
 * @param ref   Ref на измеряемый контейнер (обычно скролл-элемент виртуализатора).
 * @param steps Пороги по возрастанию `minWidth`. Первый шаг (`minWidth: 0`) — база (mobile-first).
 */
export function useContainerColumns<T extends HTMLElement>(
  ref: RefObject<T | null>,
  steps: readonly ColumnStep[],
): number {
  const [columns, setColumns] = useState<number>(() => steps[0]?.columns ?? 1);

  // Держим актуальные пороги в ref, чтобы не пере-подписывать ResizeObserver на каждый рендер.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const resolve = (width: number): number => {
      const current = stepsRef.current;
      let next = current[0]?.columns ?? 1;
      for (const step of current) {
        if (width >= step.minWidth) next = step.columns;
      }
      return next;
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      setColumns((prev) => {
        const next = resolve(width);
        return prev === next ? prev : next;
      });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}
