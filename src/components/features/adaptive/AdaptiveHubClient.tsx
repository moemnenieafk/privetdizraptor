'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRoleStore, selectEffectiveRole } from '@/store/useRoleStore';
import { ROLE_LABELS } from '@/lib/role-inference';
import { ROLE_HUBS } from '@/data/role-hubs';
import { RolePicker } from '@/components/features/adaptive/RolePicker';
import { usePlayerStore } from '@/store/usePlayerStore';

export function AdaptiveHubClient() {
  useEffect(() => {
    void useRoleStore.persist.rehydrate();
  }, []);

  const hydrated = useRoleStore((s) => s._hasHydrated);
  const derived = useRoleStore((s) => s.derived);
  const manualOverride = useRoleStore((s) => s.manualOverride);
  const effectiveRole = useRoleStore(selectEffectiveRole);
  const pve = usePlayerStore((s) => {
    const a = s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0];
    return a?.mode === 'PVE';
  });

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
  // Почему такая роль: ручной выбор или авто-инференс.
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
          <h2 className="text-sm font-blender-medium uppercase tracking-widest text-(--primary)">
            Хаб: {label.name}
          </h2>
          <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">
            {reason}
          </span>
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
              <span className="font-blender-medium text-xs uppercase tracking-wide text-text-primary">
                {link.title}
              </span>
              <span className="text-type-label font-blender-book leading-4 text-text-secondary">
                {link.description}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
