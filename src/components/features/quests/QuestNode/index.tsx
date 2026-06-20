'use client';

import { memo, useRef, useState, useEffect } from 'react';
import type { QuestNodeData } from '@/types/quest';
import type { TaskObjective, TaskObjectiveItem } from '@/types/quest';
import { useQuestStore } from '@/store/useQuestStore';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { Paperclip } from 'lucide-react';

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
    task, status, dimmed, freshlyUnlocked, pinned, chainRole,
    onToggle, onForceComplete, onSelect, onHover, onPin,
  } = data;

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  useEffect(() => () => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current); }, []);

  const startHold = (e: React.MouseEvent | React.TouchEvent) => {
    if (status !== 'locked') return;
    e.preventDefault();
    setIsHolding(true);
    holdTimerRef.current = setTimeout(() => {
      onForceComplete(task.id);
      setIsHolding(false);
    }, 5000);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    setIsHolding(false);
  };

  const itemProgress  = useQuestStore(s => s.itemProgress);
  const incrementItem = useQuestStore(s => s.incrementItem);

  const nn         = task.trader.normalizedName;
  const traderColor = `var(${traderCssVar(nn)})`;

  const gradientBg = {
    active:    `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 15%, transparent), #000000)`,
    locked:    `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 8%,  transparent), #000000)`,
    completed: `radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--color-success) 10%, transparent), #000000)`,
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
      ? 'opacity-50 border border-lines-hover text-text-secondary select-none'
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
        freshlyUnlocked ? 'animate-[fresh-unlock_0.6s_ease-out]' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(task)}
      onMouseEnter={() => onHover(task.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="absolute inset-0 z-0" style={{ background: gradientBg }} />

      <div className="relative z-10 flex flex-col">

        <header className="flex items-center gap-2 px-4 pt-4 pb-3">
          <img
            src={task.id.startsWith('story-')
              ? `/icons/eft/02-quests/${task.id}.svg`
              : traderImg(nn)}
            width={32}
            height={32}
            className="rounded-xs shrink-0"
            alt={task.trader.name}
          />
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

        <h3 className="px-4 pb-3 font-blender-medium text-sm leading-tight text-text-primary">
          {task.name}
        </h3>

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
                    <span className="text-[9px] font-blender-medium uppercase tracking-widest text-(--primary)">
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
          <button
            data-no-pan
            onClick={e => { e.stopPropagation(); if (status !== 'locked') onToggle(task.id); }}
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            style={footerBtnStyle}
            className={`${footerBtnCls} relative overflow-hidden`}
          >
            {isHolding && (
              <div
                className="absolute inset-0 bg-danger/20 origin-left"
                style={{ animation: 'hold-fill 5s linear forwards' }}
              />
            )}
            <span className="relative z-10">
              {status === 'completed' ? '✓ ВЫПОЛНЕНО'
                : status === 'locked' && isHolding ? 'Уже выполнил? Другалёк'
                : status === 'locked'              ? 'ЗАБЛОКИРОВАНО'
                : 'ВЫПОЛНЕНО?'}
            </span>
          </button>
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
        </footer>

      </div>
    </article>
  );
}

export const QuestNode = memo(QuestNodeComponent);
