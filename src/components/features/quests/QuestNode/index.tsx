'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import type { QuestNodeData } from '@/types/quest';
import type { TaskObjective, TaskObjectiveItem } from '@/types/quest';
import { useQuestStore } from '@/store/useQuestStore';
import { traderImg } from '@/lib/trader-utils';
import { TRADER_COLORS } from '@/data/traderColors';
import { getQuestHeroImg } from '@/lib/quest-utils';
import { isCollectorTask, COLLECTOR_TRACKER_HREF } from '@/lib/quest-constants';
import { Paperclip, ArrowLeftRight, ListChecks } from 'lucide-react';

function getObjectiveIcon(obj: TaskObjective): string {
  if (obj.__typename === 'TaskObjectiveTraderLevel') return 'icon-eft-quests-rep';
  if (obj.__typename === 'TaskObjectiveItem') return 'icon-eft-quests-loot';
  if (obj.__typename === 'TaskObjectiveShoot') return 'icon-eft-quests-eliminate';
  if (obj.__typename === 'TaskObjectiveMark') return 'icon-eft-quests-visit';
  if (obj.__typename === 'TaskObjectiveBasic') {
    const t = obj.type;
    if (t === 'findItem' || t === 'findQuestItem') return 'icon-eft-quests-investigate';
    if (t === 'visit' || t === 'plantItem' || t === 'plantQuestItem') return 'icon-eft-quests-visit';
    if (t === 'survive' || t === 'extract') return 'icon-eft-quests-survive';
    if (t === 'buildWeapon' || t === 'modifyWeapon') return 'icon-eft-quests-modify';
  }
  return 'icon-eft-quests-investigate';
}

function QuestNodeComponent({ data }: { data: QuestNodeData }) {
  const {
    task, status, dimmed, isSubgraphTarget, isMapTarget, freshlyUnlocked, pinned, chainRole, barterCount = 0,
    headerIconClass, hidePin,
    onToggle, onForceComplete, onSelect, onHover, onPin,
  } = data;

  // Разблокировка заблокированного квеста: клик → мини-подтверждение «Уже прошёл? Да/Нет»
  // → onForceComplete (проставляет предков-пререквизиты + сам квест). Защита от случайного разблока.
  const [confirming, setConfirming] = useState(false);

  const [heroFailed, setHeroFailed] = useState(false);

  const itemProgress  = useQuestStore(s => s.itemProgress);
  const incrementItem = useQuestStore(s => s.incrementItem);

  const nn         = task.trader.normalizedName;
  // Цвет берём из JS-палитры, а не из var(--trader-*): Tailwind v4 вырезает неиспользуемые
  // @theme-переменные из сборки, и в рантайме они не резолвятся (градиент/рамка отваливались).
  const traderColor = TRADER_COLORS[nn] ?? TRADER_COLORS.stories;

  // Подложка ноды (спека Figma 1142:1622): радиальный градиент из левого верхнего угла
  // в цвет торговца, уход в чёрный. Насыщенность в углу — 56%.
  const gradientBg = {
    active:    `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 56%, transparent), #000000)`,
    locked:    `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 22%, transparent), #000000)`,
    completed: `radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--color-success) 36%, transparent), #000000)`,
  }[status];

  const borderStyle: React.CSSProperties = status === 'active'
    ? { borderColor: traderColor, boxShadow: `0 0 12px color-mix(in srgb, ${traderColor} 30%, transparent)` }
    : status === 'completed'
    ? { borderColor: 'color-mix(in srgb, var(--color-success) 40%, transparent)' }
    : { borderColor: 'var(--color-lines-hover)' };

  const itemObjs         = task.objectives.filter(o => o.__typename === 'TaskObjectiveItem');
  const hasItemObjectives = status === 'active' && itemObjs.length > 0;
  const totalNeeded      = itemObjs.reduce((s, o) => s + ((o as TaskObjectiveItem).count ?? 0), 0);
  const totalFound       = itemObjs.reduce(
    (s, o) => s + Math.min((o as TaskObjectiveItem).count ?? 0, itemProgress[task.id]?.[o.id] ?? 0), 0
  );
  const progressPct = hasItemObjectives && totalNeeded > 0 ? (totalFound / totalNeeded) * 100 : 0;

  const opacityCls = dimmed
    ? 'opacity-20 grayscale pointer-events-none'
    : chainRole === null ? 'opacity-30'
    : status === 'completed' ? 'opacity-50'
    : '';

  const ringCls = !dimmed && chainRole !== null
    ? chainRole === 'self'       ? 'ring-2 ring-(--primary)'
    : chainRole === 'ancestor'   ? 'ring-1 ring-sky-500/60'
    : chainRole === 'descendant' ? 'ring-1 ring-(--primary)/60'
    : ''
    : '';

  const subgraphRingCls = !dimmed && isSubgraphTarget && chainRole === undefined
    ? task.lightkeeperRequired && !task.kappaRequired
      ? 'ring-1 ring-(--color-lightkeeper)/60'
      : 'ring-1 ring-(--color-kappa)/60'
    : '';

  const mapRingCls = !dimmed && isMapTarget && chainRole === undefined && !isSubgraphTarget
    ? 'ring-1 ring-amber-400/60'
    : '';

  const footerBtnStyle: React.CSSProperties = status === 'active' ? {
    backgroundColor: `color-mix(in srgb, ${traderColor} 10%, transparent)`,
    color: traderColor,
    border: `1px solid color-mix(in srgb, ${traderColor} 30%, transparent)`,
  } : {};

  const footerBtnCls = [
    'h-9 flex-1 text-xs font-blender-medium uppercase tracking-widest rounded-xs transition-colors',
    status === 'completed'
      ? 'bg-success/10 text-success'
      : status === 'locked'
      ? 'border border-lines-hover text-text-secondary hover:border-(--primary) hover:text-(--primary)'
      : '',
  ].filter(Boolean).join(' ');

  return (
    <article
      data-no-pan
      style={{ width: 348, borderWidth: 1, borderStyle: 'solid', ...borderStyle }}
      className={[
        'relative rounded-lg overflow-hidden cursor-pointer transition-all duration-150',
        opacityCls,
        ringCls,
        subgraphRingCls,
        mapRingCls,
        freshlyUnlocked ? 'animate-[fresh-unlock_0.6s_ease-out]' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(task)}
      onMouseEnter={() => onHover(task.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="absolute inset-0 z-0" style={{ background: gradientBg }} />

      <div className="relative z-10 flex flex-col">

        <header className="flex items-center gap-2 px-4 pt-4 pb-3">
          {headerIconClass ? (
            <span className={`h-8 w-8 shrink-0 icon-mask ${headerIconClass} bg-text-primary`} />
          ) : (
          <img
            src={task.id.startsWith('story-')
              ? `/icons/eft/02-quests/${task.id}.svg`
              : traderImg(nn)}
            width={32}
            height={32}
            className="rounded-xs shrink-0"
            alt={task.trader.name}
          />
          )}
          <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
            {task.trader.name}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {task.minPlayerLevel > 0 && (
              <span className="text-xs font-blender-medium text-text-secondary shrink-0">
                УР. {task.minPlayerLevel}+
              </span>
            )}
            {task.lightkeeperRequired && (
              <span
                className="w-7 h-7 flex items-center justify-center rounded-xs shrink-0"
                style={{ background: 'color-mix(in srgb, var(--trader-lightkeeper) 10%, transparent)' }}
              >
                <span className="icon-bg icon-eft-profile-lightkeeper w-4 h-4" />
              </span>
            )}
            {task.kappaRequired && (
              <span
                className="w-7 h-7 flex items-center justify-center rounded-xs shrink-0"
                style={{ background: 'color-mix(in srgb, var(--color-nvg-green) 10%, transparent)' }}
              >
                <span className="icon-bg icon-eft-profile-kappa w-4 h-4" />
              </span>
            )}
          </div>
        </header>

        {/* Hero-баннер + название в один ряд (картинка 100×56 слева, заголовок справа).
            Если картинки для квеста нет — остаётся только название на всю ширину. */}
        <div className="flex items-center gap-3.5 px-4 pb-3">
          {!heroFailed && (
            <div
              className="relative h-14 w-25 shrink-0 overflow-hidden rounded-xs border"
              style={{ borderColor: 'rgba(0,0,0,0.5)' }}
            >
              <img
                src={getQuestHeroImg(task.id)}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setHeroFailed(true)}
              />
            </div>
          )}
          <h3 className="min-w-0 flex-1 font-blender-medium text-base leading-none text-text-primary">
            {task.name}
          </h3>
        </div>

        {barterCount > 0 && (
          <div className="px-4 pb-2">
            <span
              title={`Открывает ${barterCount} бартеров`}
              className="inline-flex items-center gap-1 rounded-xs border border-lines-hover px-1.5 py-0.5 font-blender-medium text-type-caption uppercase tracking-wide text-text-muted"
            >
              <ArrowLeftRight className="h-2.5 w-2.5 text-(--primary)" />
              {barterCount} бартер{barterCount % 10 === 1 && barterCount % 100 !== 11 ? '' : barterCount % 10 >= 2 && barterCount % 10 <= 4 && (barterCount % 100 < 10 || barterCount % 100 >= 20) ? 'а' : 'ов'}
            </span>
          </div>
        )}

        <ul className="px-4 flex flex-col gap-2">
          {task.objectives.filter((obj, i, arr) => arr.findIndex(o => o.id === obj.id) === i).slice(0, 5).map(obj => {
            const done    = itemProgress[task.id]?.[obj.id] ?? 0;
            const total   = obj.__typename === 'TaskObjectiveItem'
              ? ((obj as TaskObjectiveItem).count ?? 0) : 0;
            const isItem  = obj.__typename === 'TaskObjectiveItem';
            const iconCls = getObjectiveIcon(obj);
            return (
              <li key={obj.id} className="flex items-center gap-2 py-1">
                {isItem && obj.item && (
                  <div className="relative w-7 h-7 shrink-0">
                    <div className="absolute inset-0 overflow-hidden rounded-xs border border-lines-hover">
                      <div className="absolute inset-0 bg-(--color-darkbase)" />
                      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />
                      <img
                        src={obj.item.image512pxLink}
                        alt={obj.item.shortName}
                        width={28}
                        height={28}
                        className="absolute inset-0 z-10 h-full w-full object-contain p-0.5"
                      />
                    </div>
                  </div>
                )}
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-blender-book text-text-secondary truncate">
                    {obj.description}
                  </span>
                  {isItem && obj.foundInRaid && (
                    <span className="text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">
                      НАЙДЕНО В РЕЙДЕ
                    </span>
                  )}
                </div>
                {isItem && total > 0 && (
                  <span className="text-xs font-blender-medium text-text-secondary shrink-0">
                    {done}/{total}
                  </span>
                )}
                <button
                  data-no-pan
                  onClick={e => { e.stopPropagation(); if (isItem) incrementItem(task.id, obj.id, total); }}
                  className={`icon-mask ${iconCls} shrink-0 w-4 h-4 text-text-secondary transition-opacity ${
                    done === total && total > 0 ? 'opacity-100' : 'opacity-40'
                  }`}
                />
              </li>
            );
          })}
          {task.objectives.length > 5 && (
            <li className="flex items-center gap-1.5 py-1 opacity-60">
              <span className="text-lg leading-none">···</span>
              <span className="text-sm font-blender-book text-text-secondary">
                + {task.objectives.length - 5} задач
              </span>
            </li>
          )}
        </ul>

        {hasItemObjectives && (
          <div className="mx-4 mt-3 h-0.5 bg-lines-hover rounded-full overflow-hidden">
            <div className="h-full bg-(--primary) transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        )}

        <footer className="px-4 pb-4 pt-3 flex items-center gap-2">
          {status === 'locked' && confirming ? (
            <>
              <button
                data-no-pan
                onClick={e => { e.stopPropagation(); onForceComplete(task.id); setConfirming(false); }}
                className="h-9 flex-1 rounded-xs bg-success/10 text-success text-xs font-blender-medium uppercase tracking-widest transition-colors hover:bg-success/20"
              >
                Уже прошёл
              </button>
              <button
                data-no-pan
                onClick={e => { e.stopPropagation(); setConfirming(false); }}
                className="h-9 shrink-0 rounded-xs border border-lines-hover px-4 text-xs font-blender-medium uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                Нет
              </button>
            </>
          ) : (
            <button
              data-no-pan
              onClick={e => {
                e.stopPropagation();
                if (status === 'locked') setConfirming(true);
                else onToggle(task.id);
              }}
              style={footerBtnStyle}
              className={footerBtnCls}
            >
              {status === 'completed' ? '✓ ВЫПОЛНЕНО'
                : status === 'locked' ? 'ЗАБЛОКИРОВАНО'
                : 'ВЫПОЛНЕНО?'}
            </button>
          )}
          {!hidePin && (
          <button
            data-no-pan
            onClick={e => { e.stopPropagation(); onPin(task.id); }}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xs border transition-colors"
            style={pinned
              ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }
              : { borderColor: 'var(--color-lines-hover)' }
            }
          >
            <Paperclip className={`w-4 h-4 ${pinned ? 'text-(--color-darkbase)' : 'text-text-secondary'}`} />
          </button>
          )}
        </footer>

      </div>
    </article>
  );
}

export const QuestNode = memo(QuestNodeComponent);