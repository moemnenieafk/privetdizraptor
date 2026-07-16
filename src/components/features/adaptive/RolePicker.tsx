'use client';

import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { PLAYER_ROLES, ROLE_LABELS, type PlayerRole } from '@/lib/role-inference';

// Ручной оверрайд роли активного профиля ЧВК. Используется в хабе и в Пути Новобранца.

export function RolePicker() {
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const manualOverride = useRoleStore((s) => s.byProfile[activeId]?.manualOverride ?? null);
  const setManualOverride = useRoleStore((s) => s.setManualOverride);
  const effectiveRole = useRoleStore((s) => effectiveRoleFor(s, activeId));

  const pick = (role: PlayerRole) => setManualOverride(activeId, manualOverride === role ? null : role);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-blender-medium uppercase tracking-widest text-text-primary">Кто ты в Таркове</h2>
        {manualOverride && (
          <button
            onClick={() => setManualOverride(activeId, null)}
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
        Роль своя у каждого профиля ЧВК. Портал подстроится — или подберёт сам по профилю и тому, что смотришь.
      </p>
    </section>
  );
}
