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
import { FoundInRaidBadge } from '@/components/ui/FoundInRaidBadge';
import { BarterCountBadge } from '@/components/ui/BarterCountBadge';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { isFirStashObjective, syncStashDelta } from '@/lib/quest-stash-sync';
import ITEM_BG from '@/data/quests/item-backgrounds.json';
import { Paperclip, ListChecks } from 'lucide-react';

// Тарковский фон ячейки предмета: обычные — свой цвет, квест-предметы → #686628 (yellow).
const itemBg = (id: string): string => getTarkovBackgroundColor((ITEM_BG as Record<string, string>)[id] ?? 'yellow');

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
    headerIconClass, hidePin, repeatMark,
    onToggle, onSelect, onHover, onPin,
  } = data;

  // Отметку прогресса ставит сам игрок: клик по кнопке любой ноды (в т.ч. locked)
  // просто toggle'ит этот квест. Никакого авто-каскада по предкам.
  const [heroFailed, setHeroFailed] = useState(false);

  const itemProgress  = useQuestStore(s => s.itemProgress);
  const incrementItem = useQuestStore(s => s.incrementItem);
  const decrementItem = useQuestStore(s => s.decrementItem);
  const checkedObjectives = useQuestStore(s => s.checkedObjectives);
  const toggleCheckedObjective = useQuestStore(s => s.toggleCheckedObjective);
  const setQuestDone = useQuestStore(s => s.setQuestDone);

  // У квеста одна цель → клик по ней завершает ВЕСЬ квест (нода зеленеет), ПКМ — отменяет.
  const dedupObjs = task.objectives.filter((obj, i, arr) => arr.findIndex(o => o.id === obj.id) === i);
  const singleObjective = dedupObjs.length === 1;

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

  // Кнопка отметки: активная (цвет торговца) на любой неотмеченной ноде, включая locked —
  // игрок сам решает, что прошёл. Отмеченная — зелёная.
  const footerBtnStyle: React.CSSProperties = status !== 'completed' ? {
    backgroundColor: `color-mix(in srgb, ${traderColor} 10%, transparent)`,
    color: traderColor,
    border: `1px solid color-mix(in srgb, ${traderColor} 30%, transparent)`,
  } : {};

  const footerBtnCls = [
    'h-9 flex-1 text-xs font-blender-medium uppercase tracking-widest rounded-xs transition-colors',
    status === 'completed' ? 'bg-success/10 text-success' : '',
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
            {repeatMark && (
              <span
                title={`Задание повторяется в цепочке — этап ${repeatMark.index} из ${repeatMark.total}`}
                className="flex h-5 shrink-0 items-center rounded-xs border-[0.5px] border-(--primary)/40 bg-(--primary)/10 px-1.5 font-blender-medium text-[0.625rem] uppercase tracking-wider tabular-nums text-(--primary)"
              >
                Этап {repeatMark.index}/{repeatMark.total}
              </span>
            )}
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
            <BarterCountBadge count={barterCount} />
          </div>
        )}

        <ul className="px-4 flex flex-col gap-2">
          {dedupObjs.slice(0, 5).map(obj => {
            const done    = itemProgress[task.id]?.[obj.id] ?? 0;
            const total   = obj.__typename === 'TaskObjectiveItem'
              ? ((obj as TaskObjectiveItem).count ?? 0) : 0;
            const isItem  = obj.__typename === 'TaskObjectiveItem';
            const iconCls = getObjectiveIcon(obj);
            // Готовность цели: предмет — счётчик≥нужного; прочие — прожата галка (checkedObjectives).
            const checked = isItem ? (total > 0 && done >= total) : (checkedObjectives[task.id]?.includes(obj.id) ?? false);
            return (
              <li
                key={obj.id}
                data-no-pan
                onClick={e => {
                  e.stopPropagation();
                  if (singleObjective) { setQuestDone(task, true); return; }
                  if (isItem) {
                    incrementItem(task.id, obj.id, total);
                    if (obj.item && isFirStashObjective(obj)) syncStashDelta(obj.item.id, Math.min(total, done + 1) - done);
                  } else if (!checked) toggleCheckedObjective(task.id, obj.id);
                }}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (singleObjective) { setQuestDone(task, false); return; }
                  if (isItem) {
                    decrementItem(task.id, obj.id);
                    if (obj.item && isFirStashObjective(obj)) syncStashDelta(obj.item.id, Math.max(0, done - 1) - done);
                  } else if (checked) toggleCheckedObjective(task.id, obj.id);
                }}
                title={singleObjective ? 'ЛКМ — завершить квест · ПКМ — отменить' : 'ЛКМ — отметить / +1 · ПКМ — отменить / −1'}
                className="flex items-center gap-2 py-1 cursor-pointer select-none"
              >
                {isItem && obj.item && (
                  <div className="relative w-7 h-7 shrink-0">
                    <div className="absolute inset-0 overflow-hidden rounded-xs border border-lines-hover">
                      <div className="absolute inset-0 bg-(--color-darkbase)" />
                      <div className="absolute inset-0" style={{ backgroundColor: itemBg(obj.item.id) }} />
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
                  <span className={`text-sm font-blender-book truncate transition-colors duration-150 ${
                    checked ? 'line-through text-success' : 'text-text-secondary'
                  }`}>
                    {obj.description}
                  </span>
                  {isItem && obj.foundInRaid && <FoundInRaidBadge className="mt-0.5 self-start" />}
                </div>
                {isItem && total > 0 && (
                  <span className={`text-xs font-blender-medium shrink-0 tabular-nums ${checked ? 'text-success' : 'text-text-secondary'}`}>
                    {done}/{total}
                  </span>
                )}
                <span
                  aria-hidden
                  className={`icon-mask ${iconCls} shrink-0 w-4 h-4 transition-opacity ${
                    checked ? 'opacity-100 text-success' : 'opacity-40 text-text-secondary'
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
          <button
            data-no-pan
            onClick={e => { e.stopPropagation(); onToggle(task.id); }}
            style={footerBtnStyle}
            className={footerBtnCls}
          >
            {status === 'completed' ? '✓ ВЫПОЛНЕНО' : 'ВЫПОЛНЕНО?'}
          </button>
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

        {/* Кросс-линк на трекер Kappa — только на карточке квеста «Коллекционер». */}
        {isCollectorTask(task) && (
          <div className="px-4 pb-4">
            <Link
              href={COLLECTOR_TRACKER_HREF}
              data-no-pan
              onClick={(e) => e.stopPropagation()}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xs border border-(--primary)/50 bg-(--primary)/10 text-xs font-blender-medium uppercase tracking-widest text-(--primary) transition-colors hover:bg-(--primary)/20"
            >
              <ListChecks className="h-4 w-4" /> Трекер Kappa
            </Link>
          </div>
        )}

      </div>
    </article>
  );
}

export const QuestNode = memo(QuestNodeComponent);