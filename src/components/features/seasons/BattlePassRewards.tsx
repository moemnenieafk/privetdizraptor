'use client';

// Вкладка «Награды»: страницы БП как ТАБЫ (как в игре), одна страница за раз. Карточка награды —
// игровой стиль: подложка-арт (BattlePass_Reward_Background), заливка-бак «хватает ли документов»,
// рамка-свечение (SeasonWidget_Border_Glow) на полученной, чипы стоимости «собрано/нужно».
import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { BP_PAGES, BP_REWARD_IMG, type BpDocType, type BpReward } from '@/data/eft-battlepass';
import { affordProgress, rewardDocCount, type PageProgress } from '@/lib/battlepass';
import { DocCostChips, KIND_META, RewardMedia } from './battlepassVisual';

const REWARD_BG = '/images/battlepass/ui/reward-bg.webp';
const BORDER_GLOW = '/images/battlepass/ui/border-glow.webp';

interface Props {
  claimed: ReadonlySet<string>;
  collected: Partial<Record<BpDocType, number>>;
  progressByPage: Map<number, PageProgress>;
  onToggle: (rewardId: string) => void;
  onSetPage: (rewardIds: string[], on: boolean) => void;
  onIncDoc: (type: BpDocType, delta: number) => void;
}

function RewardCard({
  reward,
  claimed,
  collected,
  locked,
  requiresPage,
  onToggle,
  onIncDoc,
}: {
  reward: BpReward;
  claimed: boolean;
  collected: Partial<Record<BpDocType, number>>;
  locked: boolean;
  requiresPage?: number;
  onToggle: () => void;
  onIncDoc: (type: BpDocType, delta: number) => void;
}) {
  const meta = KIND_META[reward.kind];
  const total = rewardDocCount(reward);
  const afford = affordProgress(reward.cost, collected);

  // Карточка — интерактивный div (внутри — кликабельные чипы-документы, вложенные <button>
  // в <button> запрещены). Клик по карточке (кроме чипов) тогглит получение.
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={claimed}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={[
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-sm border text-left transition-colors focus:outline-none focus-visible:border-(--primary)',
        claimed ? 'border-(--primary)' : afford.affordable ? 'border-nvg-green/60' : 'border-lines-hover hover:border-(--primary)/60',
      ].join(' ')}
    >
      {/* ── Арт-область: подложка + заливка-бак + иконка награды ── */}
      <div className="relative h-32 w-full shrink-0">
        {/* Подложка-арт KORD BREACH (каземат) — видимая, с затемнением снизу под текст-бейджи */}
        <span
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-70 transition-opacity duration-300 group-hover:opacity-90"
          style={{ backgroundImage: `url(${REWARD_BG})` }}
        />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-(--color-darkbase)/80 via-transparent to-(--color-darkbase)/30" />
        {/* Бак «хватает ли документов» — заливается снизу вверх */}
        <span
          aria-hidden
          className={`absolute inset-x-0 bottom-0 transition-[height] duration-500 ${afford.affordable ? 'bg-nvg-green/25' : 'bg-(--primary)/20'}`}
          style={{ height: `${claimed ? 100 : afford.pct}%` }}
        />
        {/* Иконка награды */}
        <span className="absolute inset-0 flex items-center justify-center p-2">
          <RewardMedia
            img={BP_REWARD_IMG[reward.id]}
            itemId={reward.itemId}
            kind={reward.kind}
            name={reward.name}
            className="h-full w-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
          />
        </span>
        {/* Рамка-свечение на полученной награде */}
        {claimed && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: `url(${BORDER_GLOW})`, backgroundSize: '100% 100%' }}
          />
        )}
        {/* Статус-бейдж угол */}
        <span
          className={[
            'absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-xs border',
            claimed ? 'border-(--primary) bg-(--primary) text-(--color-darkbase)' : 'border-lines-hover bg-(--color-base)/70 text-transparent group-hover:text-text-muted',
          ].join(' ')}
        >
          <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
        </span>
        {locked && !claimed && (
          <span
            title={`Сначала откройте награды страницы ${requiresPage}`}
            className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-xs border border-tactical-amber/50 bg-(--color-base)/80 px-1.5 py-0.5 font-blender-medium text-type-micro uppercase tracking-widest text-tactical-amber"
          >
            <Lock className="h-3 w-3" /> стр. {requiresPage}
          </span>
        )}
      </div>

      {/* ── Инфо ── */}
      <div className="relative flex flex-1 flex-col gap-2 bg-(--color-base) p-3">
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          {meta.label} · {total} док.
        </span>
        <span className="line-clamp-2 min-h-[2lh] font-blender-medium text-sm leading-tight text-text-primary">
          {reward.name}
        </span>
        <DocCostChips cost={reward.cost} collected={collected} onInc={onIncDoc} />
        <span
          className={`mt-auto font-blender-medium text-type-micro uppercase tracking-widest ${
            claimed ? 'text-(--primary)' : afford.affordable ? 'text-nvg-green' : 'text-text-secondary'
          }`}
        >
          {claimed ? '✓ Получено' : afford.affordable ? 'Хватает — отметить' : 'Отметить получение'}
        </span>
      </div>
    </div>
  );
}

function PageTab({
  page,
  active,
  claimedCount,
  total,
  locked,
  onClick,
}: {
  page: number;
  active: boolean;
  claimedCount: number;
  total: number;
  locked: boolean;
  onClick: () => void;
}) {
  const complete = claimedCount >= total;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`Страница ${page} · ${claimedCount}/${total} получено${locked ? ' · не открыта' : ''}`}
      className={[
        'relative flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xs border transition-colors',
        active
          ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-(--primary)'
          : complete
            ? 'border-nvg-green/50 text-nvg-green hover:border-nvg-green'
            : 'border-lines-hover text-text-secondary hover:border-(--primary)/60 hover:text-text-primary',
      ].join(' ')}
    >
      <span className="font-blender-medium text-sm">{page}</span>
      {/* мини-индикатор прогресса страницы */}
      <span className="mt-0.5 flex gap-0.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-0.5 w-1 rounded-full ${i < claimedCount ? (complete ? 'bg-nvg-green' : 'bg-(--primary)') : 'bg-lines-hover'}`}
          />
        ))}
      </span>
      {locked && !active && (
        <Lock className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-(--color-base) p-px text-tactical-amber" />
      )}
    </button>
  );
}

export function BattlePassRewards({ claimed, collected, progressByPage, onToggle, onSetPage, onIncDoc }: Props) {
  const [activePage, setActivePage] = useState(1);
  const page = BP_PAGES.find((p) => p.page === activePage) ?? BP_PAGES[0];
  const pp = progressByPage.get(page.page);
  const locked = pp ? !pp.unlocked : false;
  const ids = page.rewards.map((r) => r.id);
  const allClaimed = page.rewards.every((r) => claimed.has(r.id));

  return (
    <div className="flex flex-col gap-5">
      {/* ── Табы страниц ── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Предыдущая страница"
          onClick={() => setActivePage((p) => Math.max(1, p - 1))}
          disabled={activePage <= 1}
          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 flex-wrap justify-center gap-1.5">
          {BP_PAGES.map((p) => {
            const prog = progressByPage.get(p.page);
            return (
              <PageTab
                key={p.page}
                page={p.page}
                active={p.page === activePage}
                claimedCount={prog?.claimed ?? 0}
                total={p.rewards.length}
                locked={prog ? !prog.unlocked : false}
                onClick={() => setActivePage(p.page)}
              />
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Следующая страница"
          onClick={() => setActivePage((p) => Math.min(BP_PAGES.length, p + 1))}
          disabled={activePage >= BP_PAGES.length}
          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Шапка страницы ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-lines-hover pb-2">
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Страница {page.page}
        </h2>
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          {pp?.claimed ?? 0} / {page.rewards.length} получено
        </span>
        {page.requires && (
          <span
            className={`font-blender-medium text-type-micro uppercase tracking-widest ${locked ? 'text-tactical-amber' : 'text-text-muted'}`}
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

      {/* ── Награды страницы ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {page.rewards.map((reward) => (
          <RewardCard
            key={reward.id}
            reward={reward}
            claimed={claimed.has(reward.id)}
            collected={collected}
            locked={locked}
            requiresPage={page.requires?.fromPage}
            onToggle={() => onToggle(reward.id)}
            onIncDoc={onIncDoc}
          />
        ))}
      </div>
    </div>
  );
}
