'use client';

import { useEffect, useRef, useState } from 'react';
import { useBarterRushStore } from '@/store/useBarterRushStore';
import { useJaegerStore } from '@/store/useJaegerStore';
import { useSaveTheServersStore } from '@/store/useSaveTheServersStore';

// R09/R10-фидбэк: аркада-рекорды УЖЕ читаются агрегатом standing (usePlayerStandingSignals
// суммирует bestScore трёх игр зала — game02 «Три в ряд» рекорда не ведёт). Тут — только
// ЛЁГКИЙ отклик «standing вырос» при НОВОМ личном рекорде: подписываемся на bestScore этих
// сторов и на его РОСТ вспыхиваем тостом (animate-xp-float, существующий keyframe).
//
// Ядро игр (Canvas-модули games/*) НЕ трогаем — рекорд туда уже пишет recordRun/recordRound,
// а bestScore это React-наблюдаемый шов. Первый скачок при регидрации из localStorage НЕ
// считаем рекордом: ждём _hasHydrated по каждому стору и сидим prev значением с этого момента.

/** Суммарный лучший результат зала — тот же набор, что читает standing-агрегат. */
function useArcadeBest(): { best: number; hydrated: boolean } {
  const rushBest = useBarterRushStore((s) => s.bestScore);
  const jaegerBest = useJaegerStore((s) => s.bestScore);
  const serversBest = useSaveTheServersStore((s) => s.bestScore);
  const rushHydrated = useBarterRushStore((s) => s._hasHydrated);
  const jaegerHydrated = useJaegerStore((s) => s._hasHydrated);
  const serversHydrated = useSaveTheServersStore((s) => s._hasHydrated);

  return {
    best: rushBest + jaegerBest + serversBest,
    hydrated: rushHydrated && jaegerHydrated && serversHydrated,
  };
}

/** Плавающий тост «STANDING ВЫРОС» поверх экрана автомата. Абсолют внутри relative-родителя.
 * key меняем на каждом рекорде — перезапуск одноразовой анимации xp-float (both). */
export function StandingPulse() {
  const { best, hydrated } = useArcadeBest();
  const prev = useRef<number | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    // Первый пост-регидрационный замер — база, не рекорд (иначе тост на каждом входе).
    if (prev.current === null) {
      prev.current = best;
      return;
    }
    if (best > prev.current) setPulseKey((k) => k + 1);
    prev.current = best;
  }, [best, hydrated]);

  if (pulseKey === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center"
      aria-hidden
    >
      <span
        key={pulseKey}
        className="animate-xp-float rounded-xs border border-(--primary) bg-(--color-base)/80 px-2 py-1 font-blender-medium text-type-micro uppercase tracking-widest text-(--primary) backdrop-blur-sm"
      >
        Standing вырос · новый рекорд
      </span>
    </div>
  );
}
