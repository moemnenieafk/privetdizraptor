'use client';

// Вкладка «Награды»: 12 страниц БП, у каждой награды — стоимость документов и тогл «Получено».
// Разблокировки страниц показываем информативно (как свободный выбор в конструкторе перков),
// но тоглы не блокируем — это трекер, а не симулятор гейтинга.
import { Check } from 'lucide-react';
import { BP_PAGES, type BpReward } from '@/data/eft-battlepass';
import type { PageProgress } from '@/lib/battlepass';
import { rewardDocCount } from '@/lib/battlepass';
import { DocCostChips, KIND_META, RewardMedia } from './battlepassVisual';

interface Props {
  claimed: ReadonlySet<string>;
  progressByPage: Map<number, PageProgress>;
  onToggle: (rewardId: string) => void;
  onSetPage: (rewardIds: string[], on: boolean) => void;
}

function RewardCard({
  reward,
  claimed,
  locked,
  requiresPage,
  onToggle,
}: {
  reward: BpReward;
  claimed: boolean;
  locked: boolean;
  requiresPage?: number;
  onToggle: () => void;
}) {
  const meta = KIND_META[reward.kind];
  const total = rewardDocCount(reward);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={claimed}
      className={[
        'group relative flex flex-col gap-2.5 rounded-sm border p-3 text-left transition-colors',
        claimed
          ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_9%,transparent)]'
          : 'border-lines-hover bg-(--color-base) hover:border-(--primary)/60',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        {/* Иконка награды */}
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xs border border-lines-hover bg-(--color-darkbase) p-1.5">
          <RewardMedia itemId={reward.itemId} kind={reward.kind} name={reward.name} className="h-full w-full" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            {meta.label}
          </span>
          <span className="line-clamp-2 font-blender-medium text-sm leading-tight text-text-primary">
            {reward.name}
          </span>
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            {total} документ{plural(total)}
          </span>
        </div>

        {/* Индикатор получения */}
        <span
          className={[
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border transition-colors',
            claimed
              ? 'border-(--primary) bg-(--primary) text-(--color-darkbase)'
              : 'border-lines-hover text-transparent group-hover:border-(--primary)/60',
          ].join(' ')}
        >
          <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
        </span>
      </div>

      <DocCostChips cost={reward.cost} />

      {/* Нижняя строка: статус получения / подсказка блокировки */}
      <span className="mt-auto flex items-center justify-between gap-2">
        <span
          className={`font-blender-medium text-type-micro uppercase tracking-widest ${
            claimed ? 'text-(--primary)' : 'text-text-secondary'
          }`}
        >
          {claimed ? '✓ Получено' : 'Отметить получение'}
        </span>
        {locked && !claimed && requiresPage != null && (
          <span
            title={`Сначала откройте награды страницы ${requiresPage}`}
            className="font-blender-medium text-type-micro uppercase tracking-widest text-tactical-amber"
          >
            стр. {requiresPage} ↑
          </span>
        )}
      </span>
    </button>
  );
}

export function BattlePassRewards({ claimed, progressByPage, onToggle, onSetPage }: Props) {
  return (
    <div className="flex flex-col gap-9">
      {BP_PAGES.map((page) => {
        const pp = progressByPage.get(page.page);
        const locked = pp ? !pp.unlocked : false;
        const ids = page.rewards.map((r) => r.id);
        const allClaimed = page.rewards.every((r) => claimed.has(r.id));

        return (
          <section key={page.page} className="flex flex-col gap-3">
            {/* Заголовок страницы */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-lines-hover pb-2">
              <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
                Страница {page.page}
              </h2>
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                {pp?.claimed ?? 0} / {page.rewards.length} получено
              </span>
              {page.requires && (
                <span
                  className={`font-blender-medium text-type-micro uppercase tracking-widest ${
                    locked ? 'text-tactical-amber' : 'text-text-muted'
                  }`}
                >
                  · требует {page.requires.count} наград со стр. {page.requires.fromPage}
                  {locked ? ' (не открыта)' : ' ✓'}
                </span>
              )}
              <button
                type="button"
                onClick={() => onSetPage(ids, !allClaimed)}
                className="ml-auto flex h-7 items-center rounded-xs border border-lines-hover px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                {allClaimed ? 'Снять всё' : 'Отметить всё'}
              </button>
            </div>

            {/* Награды страницы */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              {page.rewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  claimed={claimed.has(reward.id)}
                  locked={locked}
                  requiresPage={page.requires?.fromPage}
                  onToggle={() => onToggle(reward.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Русская форма слова «документ» по числу. */
function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return '';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'а';
  return 'ов';
}
