'use client';

import type { ReactNode } from 'react';
import { useIsPve } from '@/hooks/useGameMode';

// Секционный нотис: показывается только когда активный ЧВК в PvE. Для разделов,
// где часть контента завязана на PvP (напр. достижения за убийства).
export function PveNotice({ children }: { children?: ReactNode }) {
  const isPve = useIsPve();
  if (!isPve) return null;
  return (
    <div className="mb-6 flex flex-col gap-1 rounded-xs border border-edition-tue bg-edition-tue/10 p-3">
      <span className="text-type-label font-blender-medium uppercase tracking-widest text-edition-tue">Режим ПвЕ</span>
      <span className="text-type-label font-blender-book leading-4 text-text-secondary">
        {children ?? 'Часть контента завязана на PvP и в режиме PvE неактуальна.'}
      </span>
    </div>
  );
}
