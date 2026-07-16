'use client';

// Авто-провод «Ульты»: слушает профиль ЧВК и переходы по разделам,
// пересчитывает роль (computeRole) и пишет её в useRoleStore.derived.
// Ручной оверрайд игрока всегда главнее (selectEffectiveRole).

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useBehaviorStore } from '@/store/useBehaviorStore';
import { useRoleStore } from '@/store/useRoleStore';
import { pathToDomain } from '@/lib/behavior-signals';
import { computeRole, traderLevelAvg, type ProfileFacts } from '@/lib/role-inference';

function numOrNull(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function RoleAutoWire() {
  const pathname = usePathname();
  const recomputeRef = useRef<() => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Пересчёт роли из текущего профиля + накопленных сигналов.
    recomputeRef.current = () => {
      const ps = usePlayerStore.getState();
      const active = ps.profiles.find((p) => p.id === ps.activeProfileId) ?? ps.profiles[0];
      const facts: ProfileFacts = {
        hoursPlayed: active?.hoursPlayed ?? null,
        survivalRate: active?.survivalRate ?? null,
        raids: active?.raids ?? null,
        level: numOrNull(active?.level),
        prestige: active ? Number(active.prestige) || null : null,
        mode: active?.mode ?? null,
        traderLevelAvg: active ? traderLevelAvg(active.traderLevels) : null,
      };
      const signals = useBehaviorStore.getState().signals();
      if (active) useRoleStore.getState().setDerived(active.id, computeRole(facts, signals));
    };

    // Клиентская регидратация persist-сторов (skipHydration: true).
    void useRoleStore.persist.rehydrate();
    void useBehaviorStore.persist.rehydrate();

    // Правки профиля (уровень/часы/режим/трейдеры) → дебаунс-пересчёт.
    const unsub = usePlayerStore.subscribe(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => recomputeRef.current(), 300);
    });

    // Первичный расчёт после монтирования.
    recomputeRef.current();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      unsub();
    };
  }, []);

  // Смена раздела → фиксируем визит и пересчитываем.
  useEffect(() => {
    const domain = pathToDomain(pathname || '');
    if (domain) useBehaviorStore.getState().recordVisit(domain);
    recomputeRef.current();
  }, [pathname]);

  return null;
}
