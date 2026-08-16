'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRoleStore } from '@/store/useRoleStore';
import { useRookieStore } from '@/store/useRookieStore';
import { useCosmeticStore, COSMETIC_BADGES } from '@/store/useCosmeticStore';
import { RolePicker } from '@/components/features/adaptive/RolePicker';

// Этапы «Пути Новобранца» — 10 столпов мира игры (см. docs: positioning-rookie-section).
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
  { id: 'flea', title: 'Флиа-маркет', blurb: 'Экономика и как не переплатить.', ready: true },
  { id: 'quests', title: 'Квесты', blurb: 'Двигатель прогресса.', ready: true },
  { id: 'hideout', title: 'Убежище', blurb: 'Твоя база и крафт.', ready: true },
  { id: 'ammo', title: 'Патрон решает', blurb: 'Почему дешёвый ствол убивает дорогого.', ready: true },
  { id: 'first-build', title: 'Твой первый билд', blurb: 'Собери оружие руками.', ready: true },
];

function StageRow({ stage, index, done }: { stage: RookieStage; index: number; done: boolean }) {
  const badge = done ? 'Пройдено' : stage.ready ? 'Старт' : 'Скоро';
  const badgeClass = done ? 'text-(--primary) opacity-100' : 'text-text-secondary opacity-60';
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

export function RookiePathClient() {
  useEffect(() => {
    void useRoleStore.persist.rehydrate();
    void useRookieStore.persist.rehydrate();
    void useCosmeticStore.persist.rehydrate();
  }, []);

  const hydrated = useRoleStore((s) => s._hasHydrated);
  const completed = useRookieStore((s) => s.completed);
  const cosmeticsHydrated = useCosmeticStore((s) => s._hasHydrated);
  const hasAdaptedBadge = useCosmeticStore((s) => s.earned.includes('adapted'));

  const doneCount = ROOKIE_PATH.filter((s) => completed.includes(s.id)).length;
  const pathComplete = doneCount === ROOKIE_PATH.length;

  // R12: пройден весь «Путь Новобранца» → выдать косметик-бейдж «Адаптирован». Идемпотентно —
  // award() дедупит по id, повторный заход/ре-рендер не дублирует награду и не создаёт фарм
  // (§2/A6). Standing уже растёт от сигнала tutorialDone — бейдж лишь отмечает веху.
  useEffect(() => {
    if (pathComplete && cosmeticsHydrated && !hasAdaptedBadge) {
      useCosmeticStore.getState().award('adapted');
    }
  }, [pathComplete, cosmeticsHydrated, hasAdaptedBadge]);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-9 w-full animate-pulse rounded-xs bg-lines-hover" />
        <div className="h-40 w-full animate-pulse rounded-xs bg-lines-hover" />
      </div>
    );
  }

  const adaptedBadge = COSMETIC_BADGES.adapted;

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/eft/progress/rookie"
        className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary transition-colors hover:text-(--primary)"
      >
        ← Аркады
      </Link>

      <header>
        <div className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          Обучение
        </div>
        <h1 className="mt-1 text-[1.75rem] font-blender-medium uppercase tracking-widest text-text-primary">
          Путь Новобранца
        </h1>
        <p className="mt-2 text-sm font-blender-book text-text-secondary">
          Не понимаешь Тарков? Выбери свою роль и пройди курс из 10 этапов — учим мир игры по шагам.
        </p>
      </header>

      {pathComplete && (
        <div className="flex items-center gap-4 rounded-xs border border-(--primary) bg-(--color-base) p-4 animate-[fresh-unlock_1.3s_ease-out]">
          <span
            className="icon-mask size-10 shrink-0"
            style={{
              backgroundColor: adaptedBadge.accent,
              WebkitMaskImage: `url(${adaptedBadge.iconClass})`,
              maskImage: `url(${adaptedBadge.iconClass})`,
            }}
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-blender-medium uppercase tracking-widest text-(--primary)">
                Ты адаптирован
              </span>
              <span
                className="shrink-0 rounded-xs px-1.5 py-0.5 font-blender-medium text-type-micro uppercase tracking-widest"
                style={{
                  color: adaptedBadge.accent,
                  backgroundColor: `color-mix(in srgb, ${adaptedBadge.accent} 12%, transparent)`,
                }}
              >
                Бейдж · {adaptedBadge.label}
              </span>
            </div>
            <span className="text-type-label font-blender-book text-text-secondary">
              Путь Новобранца пройден. Добро пожаловать в Тарков — теперь ты знаешь, как он устроен. Регалия
              «{adaptedBadge.label}» закреплена в досье оперативника.
            </span>
          </div>
        </div>
      )}

      <RolePicker />

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
