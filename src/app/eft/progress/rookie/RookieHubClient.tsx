'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRoleStore, selectEffectiveRole } from '@/store/useRoleStore';
import { useRookieStore } from '@/store/useRookieStore';
import { PLAYER_ROLES, ROLE_LABELS, type PlayerRole } from '@/lib/role-inference';

// Этапы «Пути Новобранца» — 10 столпов мира игры (см. docs: positioning-rookie-section).
// ready — доступен ли этап (route существует). Механики наращиваем срезами.
interface RookieStage {
  id: string;
  title: string;
  blurb: string;
  ready: boolean;
}

const ROOKIE_PATH: RookieStage[] = [
  { id: 'raid', title: 'Что такое рейд', blurb: 'Заход, лут, бой и главное — эвакуация.', ready: true },
  { id: 'pmc-scav', title: 'ЧВК и Дикий', blurb: 'Два персонажа: кем и когда играть.', ready: true },
  { id: 'secure', title: 'Не потеряй всё', blurb: 'Секур-контейнер и страховка.', ready: true },
  { id: 'fir', title: 'Найдено в рейде', blurb: 'Механика FiR — ловушка новичка.', ready: true },
  { id: 'traders', title: 'Торговцы и репутация', blurb: 'Где брать шмот и зачем квесты.', ready: true },
  { id: 'flea', title: 'Флиа-маркет', blurb: 'Экономика и как не переплатить.', ready: false },
  { id: 'quests', title: 'Квесты', blurb: 'Двигатель прогресса.', ready: false },
  { id: 'hideout', title: 'Убежище', blurb: 'Твоя база и крафт.', ready: false },
  { id: 'ammo', title: 'Патрон решает', blurb: 'Почему дешёвый ствол убивает дорогого.', ready: false },
  { id: 'first-build', title: 'Твой первый билд', blurb: 'Собери оружие руками.', ready: false },
];

function StageRow({ stage, index, done }: { stage: RookieStage; index: number; done: boolean }) {
  const badge = done ? 'Пройдено' : stage.ready ? 'Старт' : 'Скоро';
  const badgeClass = done
    ? 'text-(--primary) opacity-100'
    : 'text-text-secondary opacity-60';
  const inner = (
    <>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xs font-blender-medium text-xs ${
          done ? 'bg-(--primary) text-(--color-base)' : 'bg-lines-hover text-text-secondary'
        }`}
      >
        {String(index + 1).padStart(2, '0')}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-blender-medium text-xs uppercase tracking-wide text-text-primary">
          {stage.title}
        </span>
        <span className="truncate text-type-label font-blender-book text-text-secondary">{stage.blurb}</span>
      </div>
      <span className={`shrink-0 font-blender-medium text-type-label uppercase tracking-wide ${badgeClass}`}>
        {badge}
      </span>
    </>
  );

  const base = 'flex items-center gap-3 rounded-xs border border-lines-hover bg-(--color-base) p-3';
  if (stage.ready) {
    return (
      <Link href={`/eft/progress/rookie/${stage.id}`} className={`${base} transition-colors hover:border-(--primary)`}>
        {inner}
      </Link>
    );
  }
  return <div className={`${base} opacity-70`}>{inner}</div>;
}

export function RookieHubClient() {
  useEffect(() => {
    void useRoleStore.persist.rehydrate();
    void useRookieStore.persist.rehydrate();
  }, []);

  const hydrated = useRoleStore((s) => s._hasHydrated);
  const manualOverride = useRoleStore((s) => s.manualOverride);
  const setManualOverride = useRoleStore((s) => s.setManualOverride);
  const effectiveRole = useRoleStore(selectEffectiveRole);
  const completed = useRookieStore((s) => s.completed);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-9 w-full animate-pulse rounded-xs bg-lines-hover" />
        <div className="h-40 w-full animate-pulse rounded-xs bg-lines-hover" />
      </div>
    );
  }

  const pick = (role: PlayerRole) => setManualOverride(manualOverride === role ? null : role);
  const doneCount = ROOKIE_PATH.filter((s) => completed.includes(s.id)).length;

  return (
    <div className="flex flex-col gap-8">
      {/* Ролевой переключатель — ручной оверрайд «Ульты». */}
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

      {/* Путь Новобранца. */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-blender-medium uppercase tracking-widest text-text-primary">Путь Новобранца</h2>
          <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">
            {doneCount} / {ROOKIE_PATH.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROOKIE_PATH.map((stage, i) => (
            <StageRow key={stage.id} stage={stage} index={i} done={completed.includes(stage.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}
