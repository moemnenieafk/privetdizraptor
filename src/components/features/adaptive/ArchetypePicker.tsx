'use client';

import { X } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { PLAYER_ROLES, ROLE_LABELS, type PlayerRole } from '@/lib/role-inference';
import { ARCHETYPE_VISUALS } from '@/data/archetype-visuals';
import { HexRingProgress } from '@/components/features/adaptive/HexRingProgress';

// Пикер архетипа (Figma 2869-5533 «Select - Archetype»): вертикальный список ВСЕХ 15
// архетипов «в том же фрейме» правой панели Досье. Заменяет плоский RolePicker.
// Строка = гекс-кольцо (80px, иконка архетипа) + кнопка-лейбл (ROLE_LABELS[role].button).
// Текущий (effectiveRole) помечен «ВАШ» + вордмарк title_archetype + амбер-подсветка строки.
// Клик по строке → setManualOverride(activeId, role) + закрыть; клик по текущему — сброс.

interface ArchetypePickerProps {
  /** Закрыть пикер (вернуться к панели прогрессии). */
  onClose: () => void;
}

export function ArchetypePicker({ onClose }: ArchetypePickerProps) {
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const setManualOverride = useRoleStore((s) => s.setManualOverride);
  const effectiveRole = useRoleStore((s) => effectiveRoleFor(s, activeId));

  const pick = (role: PlayerRole) => {
    // Повторный клик по текущему архетипу — сброс к авто-инференсу; иначе — ручной выбор.
    setManualOverride(activeId, role === effectiveRole ? null : role);
    onClose();
  };

  return (
    <div className="flex min-h-full flex-col rounded-lg bg-(--color-darkbase)">
      {/* Заголовок пикера: «ВЫБОР АРХЕТИПА» + крестик-закрыть */}
      <div className="flex items-center justify-between gap-3 px-7 py-4">
        <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          Выбор архетипа
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Список архетипов */}
      <div className="flex flex-col overflow-y-auto">
        {PLAYER_ROLES.map((role, i) => {
          const visual = ARCHETYPE_VISUALS[role];
          const label = ROLE_LABELS[role];
          const current = role === effectiveRole;
          const first = i === 0;

          return (
            <button
              key={role}
              type="button"
              onClick={() => pick(role)}
              className={`flex w-full items-center gap-3.5 px-7 py-3.5 text-left transition-colors ${
                current
                  ? `bg-tactical-amber/10 ${first ? 'rounded-t-lg' : ''}`
                  : 'hover:bg-card-menu'
              } ${first ? '' : 'border-t border-lines-hover'}`}
            >
              <HexRingProgress progress={1} accent={visual.accent} iconClass={visual.iconClass} size={80} />

              <span className="flex min-w-0 flex-col gap-0.5">
                {current && (
                  <span className="flex items-center gap-2">
                    <span className="text-type-micro font-blender-medium uppercase tracking-widest text-tactical-amber">
                      Ваш
                    </span>
                    <img
                      src="/icons/eft/04-progression/cta-profile/title_archetype.svg"
                      alt="ЦТА · Архетип"
                      className="h-4 w-auto"
                    />
                  </span>
                )}
                <span
                  className={`truncate text-xl font-blender-medium uppercase tracking-widest ${
                    current ? 'text-tactical-amber' : 'text-text-primary'
                  }`}
                >
                  {label.button}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
