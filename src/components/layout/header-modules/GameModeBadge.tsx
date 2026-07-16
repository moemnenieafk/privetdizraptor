'use client';

import { useEffect, useState } from 'react';
import { useIsPve } from '@/hooks/useGameMode';

// Виден на всём сайте, когда активный ЧВК в PvE. Это же — сигнал, что данные/фичи в PvE-режиме.
// При появлении (переключении в PvE) — короткий пульс: вспышка фона + scale-поп,
// чтобы смена режима читалась. prefers-reduced-motion → без анимации.
export function GameModeBadge() {
  const isPve = useIsPve();
  const [entered, setEntered] = useState(false);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    if (!isPve) {
      setEntered(false);
      return;
    }
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    setAnimate(!reduce);
    if (reduce) {
      setEntered(true);
      return;
    }
    setEntered(false); // старт с приглушённого/сжатого состояния…
    const id = requestAnimationFrame(() => setEntered(true)); // …и на следующий кадр — переход
    return () => cancelAnimationFrame(id);
  }, [isPve]);

  if (!isPve) return null;

  return (
    <div
      className={`flex h-7 items-center rounded-xs border border-edition-tue px-2 ${animate ? 'transition-all duration-300 ease-out' : ''} ${entered ? 'scale-100 bg-edition-tue/10 opacity-100' : 'scale-90 bg-edition-tue/30 opacity-0'}`}
      title="Активен режим PvE"
    >
      <span className="text-type-label font-blender-medium uppercase tracking-widest text-edition-tue">ПвЕ</span>
    </div>
  );
}
