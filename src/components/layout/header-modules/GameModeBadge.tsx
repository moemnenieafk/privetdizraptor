'use client';

import { useIsPve } from '@/hooks/useGameMode';

// Виден на всём сайте, когда активный ЧВК в PvE. Это же — сигнал, что данные/фичи в PvE-режиме.
export function GameModeBadge() {
  const isPve = useIsPve();
  if (!isPve) return null;
  return (
    <div className="flex h-7 items-center rounded-xs border border-edition-tue bg-edition-tue/10 px-2" title="Активен режим PvE">
      <span className="text-type-label font-blender-medium uppercase tracking-widest text-edition-tue">ПвЕ</span>
    </div>
  );
}
