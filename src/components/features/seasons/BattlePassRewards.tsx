'use client';

// Левая колонка трекера: страницы БП как ТАБЫ, одна за раз. Карточка — арт + иконка награды +
// свечение состояния + ячейки стоимости (ЛКМ+/ПКМ−) + явная кнопка (единственный контрол).
// Табы: точки-индикаторы статуса наград, цвет номера, замок reward-lock. При полном сборе
// страницы — авто-переход через 5 сек с мем-фразой (grill V4DYA 2026-08-14).
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { BP_PAGES, BP_REWARD_IMG, type BpDocType, type BpReward } from '@/data/eft-battlepass';
import { affordProgress, rewardDocCount, type PageProgress } from '@/lib/battlepass';
import { BP_REWARD_FACTION, DocCostCells, KIND_META, RewardMedia } from './battlepassVisual';
import { BP_UI } from './battlepassAssets';

const MASK = 'mask-contain mask-center mask-no-repeat';

// Статус награды для точек-индикаторов таба (grill V4DYA): бирюза=получено, amber=доступно,
// #9696A1=по умолчанию, #313135=заблокировано.
type DotState = 'done' | 'ready' | 'default' | 'locked';
const DOT_BG: Record<DotState, string> = {
  done: 'bg-season-01',
  ready: 'bg-tactical-amber',
  default: 'bg-text-secondary',
  locked: 'bg-lines-hover',
};

// Мем-фразы в стиле EFT для авто-перехода на следующую страницу.
const ADVANCE_PHRASES = [
  'Кабанчиком на следующую!',
  'Тарков не ждёт, братишка.',
  'Чики-брики и в дамки — дальше!',
  'Нычка собрана, двигаем.',
  'Экстракт открыт — на выход к наградам!',
  'Лут поднят, ноги в руки.',
  'Респект, оперативник. Следующая цель!',
  'Страница зачищена — вперёд за ливаром!',
  'Всё поднято, не тупим — бежим дальше!',
  'ЧВК одобряет. На следующую!',
  'Кекв, изи катка. Дальше!',
];

interface Props {
  claimed: ReadonlySet<string>;
  collected: Partial<Record<BpDocType, number>>;
  progressByPage: Map<number, PageProgress>;
  onToggleReward: (reward: BpReward) => void;
  onIncDoc: (type: BpDocType, delta: number) => void;
  onCatchUp: (uptoPage: number) => void;
  /** Дневной лимит исчерпан и таймер отката идёт → доступные награды под замком «Заблокировано». */
  dailyLocked: boolean;
  /** Сброс дневного таймера (после подтверждения в модалке «Уже прошёл день?»). */
  onDailyReset: () => void;
}

function rewardDotState(
  reward: BpReward,
  claimed: ReadonlySet<string>,
  collected: Partial<Record<BpDocType, number>>,
  pageLocked: boolean,
): DotState {
  if (claimed.has(reward.id)) return 'done';
  if (pageLocked) return 'locked';
  return affordProgress(reward.cost, collected).affordable ? 'ready' : 'default';
}

function RewardCard({
  reward,
  claimed,
  collected,
  locked,
  dailyLocked,
  requiresPage,
  onToggle,
  onIncDoc,
  onCatchUp,
  onDailyHold,
}: {
  reward: BpReward;
  claimed: boolean;
  collected: Partial<Record<BpDocType, number>>;
  locked: boolean;
  dailyLocked: boolean;
  requiresPage?: number;
  onToggle: () => void;
  onIncDoc: (type: BpDocType, delta: number) => void;
  onCatchUp: () => void;
  onDailyHold: () => void;
}) {
  const meta = KIND_META[reward.kind];
  const total = rewardDocCount(reward);
  const afford = affordProgress(reward.cost, collected);
  // Два замка: прогрессия (страница не открыта) и дневной лимит (таймер отката). Прогрессия в приоритете.
  const progLocked = locked && !claimed;
  const dayLocked = dailyLocked && !claimed && !locked;
  const anyLocked = progLocked || dayLocked;
  const ready = !claimed && !anyLocked && afford.affordable;
  const factions = BP_REWARD_FACTION[reward.id];
  const canHold = anyLocked;

  // Hold-to-unlock (grill V4DYA): заблок-кнопку зажать 7 сек. Прогрессия → добор документов до страницы;
  // дневной лимит → открыть модалку «Уже прошёл день?» (сброс таймера подтверждается в ней).
  const [holdPct, setHoldPct] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHoldPct(0);
  };
  const startHold = () => {
    if (!canHold || holdTimer.current) return;
    const t0 = Date.now();
    holdTimer.current = setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / 7000) * 100);
      setHoldPct(p);
      if (p >= 100) {
        clearHold();
        if (progLocked) onCatchUp();
        else onDailyHold();
      }
    }, 50);
  };

  const borderCls = claimed
    ? 'border-season-01/70'
    : ready
      ? 'border-(--primary)/60'
      : dayLocked
        ? 'border-danger/40'
        : 'border-lines-hover';
  const glow = claimed ? BP_UI.rewardDone : ready ? BP_UI.rewardReady : null;
  const bgCls = claimed || ready ? 'bg-(--color-darkbase)' : 'bg-card-menu';

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-sm border ${bgCls} ${borderCls} ${
        anyLocked ? 'opacity-70' : ''
      }`}
    >
      {/* ── Арт: подложка + иконка награды + свечение состояния ── */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden">
        <span aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${BP_UI.rewardBg})` }} />
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-(--color-base) via-transparent to-transparent" />
        <span className="absolute inset-0 flex items-center justify-center p-4">
          <RewardMedia
            img={BP_REWARD_IMG[reward.id]}
            itemId={reward.itemId}
            kind={reward.kind}
            name={reward.name}
            className="max-h-full max-w-full drop-shadow-[0_4px_14px_rgba(0,0,0,0.7)]"
          />
        </span>
        {glow && (
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: `url(${glow})`, backgroundSize: '100% 100%' }} />
        )}
        {/* Замок — верхний левый угол (прогрессия или дневной лимит) */}
        {anyLocked && (
          <span
            title={
              progLocked
                ? `В игре откроется после ${requiresPage ? `набора наград со стр. ${requiresPage}` : 'выполнения условия'} · отметить можно`
                : 'Дневной лимит сбора документов исчерпан — награды под замком до отката таймера'
            }
            className={`absolute left-2 top-2 flex items-center gap-1 rounded-xs border bg-(--color-darkbase)/85 px-1.5 py-0.5 ${
              dayLocked ? 'border-danger/50' : 'border-lines-hover'
            }`}
          >
            <span aria-hidden className={`icon-eft-reward-lock h-3.5 w-3.5 ${dayLocked ? 'bg-danger' : 'bg-text-muted'} ${MASK}`} />
            <span className={`font-blender-medium text-type-micro uppercase tracking-widest ${dayLocked ? 'text-danger' : 'text-text-muted'}`}>
              {progLocked ? (requiresPage ? `стр. ${requiresPage}` : 'условие') : 'лимит'}
            </span>
          </span>
        )}
        {/* Фракция — верхний правый угол (напротив замка), grill V4DYA */}
        {factions && (
          <span className="absolute right-2 top-2 flex items-center gap-1">
            {factions.map((f) => (
              <span
                key={f}
                aria-hidden
                title={f.toUpperCase()}
                className={`${f === 'bear' ? 'icon-eft-bear-faction' : 'icon-eft-usec-faction'} h-4 w-4 bg-text-secondary ${MASK}`}
              />
            ))}
          </span>
        )}
      </div>

      {/* ── Инфо ── */}
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">{meta.label}</span>
          <span className="flex items-center gap-1 font-blender-medium text-type-micro text-text-secondary">
            {total}
            <span aria-hidden className={`icon-eft-battlepass-docs-coin h-4 w-4 bg-text-muted ${MASK}`} />
          </span>
        </div>

        <span className="line-clamp-2 min-h-[2lh] font-blender-medium text-sm uppercase leading-tight text-text-primary">
          {reward.name}
        </span>

        <DocCostCells cost={reward.cost} collected={collected} claimed={claimed} onInc={onIncDoc} />

        {/* Кнопка — единственный контрол получения */}
        <button
          type="button"
          onClick={canHold ? undefined : onToggle}
          onPointerDown={canHold ? startHold : undefined}
          onPointerUp={canHold ? clearHold : undefined}
          onPointerLeave={canHold ? clearHold : undefined}
          title={
            canHold
              ? progLocked
                ? 'Зажми на 7 сек — доберём документы до этой страницы и разблокируем'
                : 'Зажми на 7 сек — если игровые сутки уже сменились, перезапустим таймер лимита'
              : undefined
          }
          className={[
            'relative mt-auto flex h-9 items-center justify-center gap-1.5 overflow-hidden rounded border font-blender-medium text-type-micro uppercase tracking-widest transition-colors',
            claimed
              ? 'border-transparent bg-season-01/10 text-season-01 hover:bg-season-01/15'
              : ready
                ? 'border-(--primary) bg-(--primary) text-(--color-base) hover:bg-[color-mix(in_srgb,var(--primary)_88%,black)]'
                : dayLocked
                  ? 'border-danger/40 text-danger select-none'
                  : anyLocked
                    ? 'border-lines-hover text-text-muted select-none'
                    : 'border-transparent bg-lines-hover text-text-secondary hover:text-(--primary)',
          ].join(' ')}
        >
          {canHold && holdPct > 0 && (
            <span aria-hidden className="absolute inset-y-0 left-0 bg-tactical-amber/30" style={{ width: `${holdPct}%` }} />
          )}
          <span className="relative flex items-center gap-1.5">
            {claimed ? (
              <>
                <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Получено
              </>
            ) : ready ? (
              'Получить награду'
            ) : anyLocked ? (
              <>
                <span aria-hidden className={`icon-eft-reward-lock h-3.5 w-3.5 ${dayLocked ? 'bg-danger' : 'bg-text-muted'} ${MASK}`} />
                {holdPct > 0 ? 'Разблокировка…' : 'Заблокировано'}
              </>
            ) : (
              'Отметить получение'
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

function PageTab({
  page,
  active,
  states,
  locked,
  onClick,
}: {
  page: number;
  active: boolean;
  states: DotState[];
  locked: boolean;
  onClick: () => void;
}) {
  const complete = states.length > 0 && states.every((s) => s === 'done');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`Страница ${page}${locked ? ' · не открыта' : ''}`}
      className={[
        'relative flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded border transition-colors',
        active
          ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_14%,transparent)]'
          : complete
            ? 'border-season-01/40 hover:border-season-01'
            : 'border-lines-hover hover:border-(--primary)/60',
        locked && !active ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Цвет номера: активный/по умолчанию — F2F2F2, неактивный+заблокированный — 54545C */}
      <span className={`font-blender-medium text-lg leading-none ${locked && !active ? 'text-text-muted' : 'text-text-primary'}`}>
        {page}
      </span>
      <span className="flex gap-[3px]">
        {states.map((s, i) => (
          <span key={i} className={`h-1 w-1 rounded-full ${DOT_BG[s]}`} />
        ))}
      </span>
      {complete ? (
        <Check className="absolute right-1 top-1 h-2.5 w-2.5 text-season-01" strokeWidth={3} aria-hidden />
      ) : locked && !active ? (
        <span aria-hidden className={`absolute right-1 top-1 h-2.5 w-2.5 icon-eft-reward-lock bg-text-muted ${MASK}`} />
      ) : null}
    </button>
  );
}

export function BattlePassRewards({
  claimed,
  collected,
  progressByPage,
  onToggleReward,
  onIncDoc,
  onCatchUp,
  dailyLocked,
  onDailyReset,
}: Props) {
  const [activePage, setActivePage] = useState(1);
  const [advance, setAdvance] = useState<{ phrase: string; sec: number } | null>(null);
  const [dayResetOpen, setDayResetOpen] = useState(false);
  const page = BP_PAGES.find((p) => p.page === activePage) ?? BP_PAGES[0];
  const pp = progressByPage.get(page.page);
  const locked = pp ? !pp.unlocked : false;

  // Авто-переход: страница полностью собрана → 5-сек таймер с мем-фразой → следующая доступная.
  useEffect(() => {
    const pg = BP_PAGES.find((p) => p.page === activePage);
    if (!pg || pg.rewards.length === 0) return;
    const allClaimed = pg.rewards.every((r) => claimed.has(r.id));
    const next = BP_PAGES.find((p) => p.page > activePage && !p.rewards.every((r) => claimed.has(r.id)));
    if (!allClaimed || !next) {
      setAdvance(null);
      return;
    }
    setAdvance({ phrase: ADVANCE_PHRASES[Math.floor(Math.random() * ADVANCE_PHRASES.length)], sec: 5 });
    const iv = setInterval(() => {
      setAdvance((a) => {
        if (!a) return a;
        if (a.sec <= 1) {
          clearInterval(iv);
          setActivePage(next.page);
          return null;
        }
        return { ...a, sec: a.sec - 1 };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [activePage, claimed]);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Табы страниц ── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Предыдущая страница"
          onClick={() => setActivePage((p) => Math.max(1, p - 1))}
          disabled={activePage <= 1}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 justify-center gap-1.5 overflow-x-auto">
          {BP_PAGES.map((p) => {
            const prog = progressByPage.get(p.page);
            const pLocked = prog ? !prog.unlocked : false;
            const states = p.rewards.map((r) => rewardDotState(r, claimed, collected, pLocked));
            return (
              <PageTab
                key={p.page}
                page={p.page}
                active={p.page === activePage}
                states={states}
                locked={pLocked}
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
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Баннер авто-перехода (страница собрана) ── */}
      {advance && (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-season-01/50 bg-season-01/10 px-4 py-2.5">
          <div className="flex flex-col">
            <span className="font-blender-medium text-sm uppercase tracking-widest text-season-01">Погнали дальше, Другалёк!</span>
            <span className="font-blender-book text-type-caption text-text-secondary">{advance.phrase}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-blender-medium text-2xl leading-none text-season-01">{advance.sec}</span>
            <button
              type="button"
              onClick={() => setAdvance(null)}
              className="rounded-xs border border-lines-hover px-2 py-1 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors hover:border-text-secondary hover:text-text-secondary"
            >
              Остаться
            </button>
          </div>
        </div>
      )}

      {/* ── Награды страницы ── */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {page.rewards.map((reward) => (
          <RewardCard
            key={reward.id}
            reward={reward}
            claimed={claimed.has(reward.id)}
            collected={collected}
            locked={locked}
            dailyLocked={dailyLocked}
            requiresPage={page.requires?.fromPage}
            onToggle={() => onToggleReward(reward)}
            onIncDoc={onIncDoc}
            onCatchUp={() => onCatchUp(reward.page)}
            onDailyHold={() => setDayResetOpen(true)}
          />
        ))}
      </div>

      {/* ── Модалка «Уже прошёл день?» — перезапуск дневного таймера (7-сек удержание карточки) ── */}
      {dayResetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDayResetOpen(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-4 rounded-sm border border-danger/50 bg-card-menu p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <span aria-hidden className={`icon-eft-reward-lock h-6 w-6 bg-danger ${MASK}`} />
              <h3 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">Уже прошёл день?</h3>
            </div>
            <p className="font-blender-book text-type-caption leading-relaxed text-text-secondary">
              Дневной лимит держит награды под замком до отката таймера. Если игровые сутки уже сменились —
              перезапустим таймер лимита с нуля и снова откроем получение наград. Жми, только если день реально
              наступил, иначе собьёшь свой честный отсчёт.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDayResetOpen(false)}
                className="rounded border border-lines-hover px-3 py-1.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  onDailyReset();
                  setDayResetOpen(false);
                }}
                className="rounded bg-danger px-3 py-1.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-primary transition-[filter] hover:brightness-110"
              >
                Да, перезапустить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
