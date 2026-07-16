'use client';

import { useRoleStore, selectEffectiveRole } from '@/store/useRoleStore';
import { PLAYER_ROLES, ROLE_LABELS, type PlayerRole } from '@/lib/role-inference';

// Ручной оверрайд роли «Ульты». Используется и в хабе, и в Пути Новобранца.

export function RolePicker() {
  const manualOverride = useRoleStore((s) => s.manualOverride);
  const setManualOverride = useRoleStore((s) => s.setManualOverride);
  const effectiveRole = useRoleStore(selectEffectiveRole);

  const pick = (role: PlayerRole) => setManualOverride(manualOverride === role ? null : role);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-blender-medium uppercase tracking-widest text-text-primary">Кто ты в Таркове</h2>
        {manualOverride && (
          <button
            onClick={() => setManualOverride(null)}
            className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary transition-colors hover:text-(--primary)"
          >
            Сбросить
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {PLAYER_ROLES.map((role) => {
          const active = effectiveRole === role;
          return (
            <button
              key={role}
              onClick={() => pick(role)}
              className={`flex h-9 items-center rounded-xs border px-4 font-blender-medium text-xs uppercase tracking-wide transition-colors ${
                active
                  ? 'border-(--primary) text-(--primary)'
                  : 'border-lines-hover text-text-secondary hover:border-text-secondary'
              }`}
            >
              {ROLE_LABELS[role].button}
            </button>
          );
        })}
      </div>
      <p className="text-type-label font-blender-book text-text-secondary">
        Портал подстроится под выбранную роль. Дальше подскажет сам — по твоему профилю и тому, что смотришь.
      </p>
    </section>
  );
}
