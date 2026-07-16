'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { ROLE_LABELS, type RoleInference } from '@/lib/role-inference';
import { ROLE_HUBS } from '@/data/role-hubs';
import { RolePicker } from '@/components/features/adaptive/RolePicker';
import { Paywall } from '@/components/features/subscription/Paywall';
import { useIsPve } from '@/hooks/useGameMode';

const STAGE_LABEL: Record<RoleInference['stage'], string> = {
  timmy: 'Новичок',
  mid: 'Средний',
  endgame: 'Эндгейм',
};

function AxisBar({ left, right, value }: { left: string; right: string; value: number }) {
  const pct = ((value + 1) / 2) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-type-label font-blender-book text-text-secondary">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="relative h-1.5 w-full rounded-xs bg-lines-hover">
        <div className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-xs bg-(--primary)" style={{ left: `calc(${pct}% - 2px)` }} />
      </div>
    </div>
  );
}

function Insights({ derived }: { derived: RoleInference | null }) {
  if (!derived) {
    return (
      <p className="text-type-label font-blender-book text-text-secondary">
        Для авто-профиля пока мало данных — полазай по разделам, и роль соберётся сама.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">
          Уверенность: <span className="text-(--primary)">{Math.round(derived.confidence * 100)}%</span>
        </span>
        <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">
          Вторая роль: <span className="text-text-primary">{derived.secondary ? ROLE_LABELS[derived.secondary].name : '—'}</span>
        </span>
        <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">
          Стадия: <span className="text-text-primary">{STAGE_LABEL[derived.stage]}</span>
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <AxisBar left="Осторожный" right="Агрессивный" value={derived.axes.cautionAggression} />
        <AxisBar left="Эконом" right="Боевой" value={derived.axes.economyCombat} />
        <AxisBar left="Спидран" right="Коллекционер" value={derived.axes.sprintCollect} />
        <AxisBar left="Соло" right="Сокланы" value={derived.axes.soloClan} />
      </div>
      {derived.reasons.length > 0 && (
        <p className="text-type-label font-blender-book leading-4 text-text-secondary">
          {derived.reasons.join(' · ')}
        </p>
      )}
    </div>
  );
}

export function AdaptiveHubClient() {
  useEffect(() => {
    void useRoleStore.persist.rehydrate();
  }, []);

  const hydrated = useRoleStore((s) => s._hasHydrated);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const derived = useRoleStore((s) => s.byProfile[activeId]?.derived ?? null);
  const manualOverride = useRoleStore((s) => s.byProfile[activeId]?.manualOverride ?? null);
  const effectiveRole = useRoleStore((s) => effectiveRoleFor(s, activeId));
  const pve = useIsPve();

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-9 w-full animate-pulse rounded-xs bg-lines-hover" />
        <div className="h-48 w-full animate-pulse rounded-xs bg-lines-hover" />
      </div>
    );
  }

  const hub = ROLE_HUBS[effectiveRole];
  const label = ROLE_LABELS[effectiveRole];
  const reason = manualOverride
    ? 'Выбрано вручную'
    : derived?.reasons?.length
      ? derived.reasons.join(' · ')
      : 'По умолчанию';

  return (
    <div className="flex flex-col gap-8">
      <RolePicker />

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-blender-medium uppercase tracking-widest text-(--primary)">Хаб: {label.name}</h2>
          <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">{reason}</span>
        </div>
        {pve && (
          <div className="flex flex-col gap-1 rounded-xs border border-edition-tue bg-edition-tue/10 p-3">
            <span className="text-type-label font-blender-medium uppercase tracking-widest text-edition-tue">Режим ПвЕ</span>
            <span className="text-type-label font-blender-book leading-4 text-text-secondary">
              {hub.pveHint ?? 'Барахолка ограничена — упор на лут, крафты и сюжет, без гонки live-цен.'}
            </span>
          </div>
        )}
        <p className="text-sm font-blender-book text-text-secondary">{hub.intro}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {hub.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col gap-1 rounded-xs border border-lines-hover bg-(--color-base) p-4 transition-colors hover:border-(--primary)"
            >
              <span className="font-blender-medium text-xs uppercase tracking-wide text-text-primary">{link.title}</span>
              <span className="text-type-label font-blender-book leading-4 text-text-secondary">{link.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-blender-medium uppercase tracking-widest text-text-primary">Инсайты роли</h2>
        <Paywall feature="role_insights">
          <Insights derived={derived} />
        </Paywall>
      </section>
    </div>
  );
}
