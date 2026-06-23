'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Paperclip, Maximize2, Map as MapIcon, ArrowLeftRight, ChevronRight } from 'lucide-react';
import { useQuestStore } from '@/store/useQuestStore';
import { QuestItemTracker } from '@/components/features/quests/QuestItemTracker';
import type { TaskRaw, TaskObjective, TaskObjectiveItem, QuestBarterLite } from '@/types/quest';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { getQuestHeroImg } from '@/lib/quest-utils';
import questGuides from '@/data/quest-guides.json';

const BASIC_TYPE_ICON: Record<string, string> = {
  visit:          'icon-eft-quests-visit',
  extract:        'icon-eft-quests-survive',
  survive:        'icon-eft-quests-survive',
  findItem:       'icon-eft-quests-investigate',
  findQuestItem:  'icon-eft-quests-investigate',
  plantItem:      'icon-eft-quests-visit',
  plantQuestItem: 'icon-eft-quests-visit',
  buildWeapon:    'icon-eft-quests-modify',
  modifyWeapon:   'icon-eft-quests-modify',
};

const TYPENAME_ICON: Record<string, string> = {
  TaskObjectiveItem:        'icon-eft-quests-loot',
  TaskObjectiveMark:        'icon-eft-quests-visit',
  TaskObjectiveShoot:       'icon-eft-quests-eliminate',
  TaskObjectivePlayerLevel: 'icon-eft-profile-pvp',
  TaskObjectiveTraderLevel: 'icon-eft-quests-rep',
};

function getObjIcon(typename?: string, type?: string): string {
  if (typename === 'TaskObjectiveBasic' && type) {
    return BASIC_TYPE_ICON[type] ?? 'icon-eft-quests-investigate';
  }
  return typename ? (TYPENAME_ICON[typename] ?? 'icon-eft-quests-investigate') : 'icon-eft-quests-investigate';
}

function ObjectiveRow({ obj, checked, onToggle }: { obj: TaskObjective; checked: boolean; onToggle: () => void }) {
  const iconCls = getObjIcon(obj.__typename, obj.type);
  return (
    <li className={`flex items-start gap-3 ${obj.optional ? 'opacity-50 italic' : ''}`}>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-start gap-3 cursor-pointer" onClick={onToggle}>
          <span className={`text-base font-blender-book leading-snug flex-1 transition-colors duration-150 ${
            checked ? 'line-through text-success' : 'text-text-primary'
          }`}>
            {obj.description}
          </span>
          <div className="flex items-start gap-1.5 shrink-0 pt-0.5">
            {obj.optional && (
              <span className="text-type-caption font-blender-medium uppercase not-italic text-text-secondary border border-lines-hover rounded-xs px-1 py-0.5">
                НЕ ОБЯ.
              </span>
            )}
            <span className={`${iconCls} icon-mask w-4 h-4 shrink-0 transition-colors duration-150 ${
              checked ? 'text-success' : 'text-text-secondary'
            }`} />
          </div>
        </div>

        {obj.__typename === 'TaskObjectiveItem' && obj.item && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs font-blender-medium text-text-secondary">{obj.item.shortName}</span>
            {obj.count != null && obj.count > 1 && (
              <span className="text-xs font-blender-medium text-text-secondary">× {obj.count}</span>
            )}
            {obj.foundInRaid && (
              <span className="flex items-center gap-1 text-xs font-blender-medium text-(--primary)">
                <span className="icon-eft-find-in-raid icon-mask w-3 h-3 shrink-0" />
                найдено в рейде
              </span>
            )}
          </div>
        )}

        {obj.__typename === 'TaskObjectiveShoot' && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {obj.target && (
              <span className="text-xs font-blender-medium text-text-secondary">{obj.target}</span>
            )}
            {obj.distance != null && (
              <span className="text-xs font-blender-medium text-text-secondary">{obj.distance.value}м</span>
            )}
          </div>
        )}

        {obj.__typename === 'TaskObjectiveTraderLevel' && obj.trader && (
          <div className="flex items-center gap-1.5 mt-2">
            <img
              src={traderImg(obj.trader.normalizedName)}
              alt={obj.trader.name}
              width={12}
              height={12}
              className="rounded-[1px] shrink-0"
            />
            <span className="text-xs font-blender-medium text-text-secondary">
              {obj.trader.name} — ЛВЛ. {obj.level}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

interface Props {
  task: TaskRaw;
  /** drawer — узкая панель на карте; page — полноэкранная страница /eft/quests/task/[id]. */
  variant?: 'drawer' | 'page';
  /** Только drawer: закрытие панели (показывает крестик). */
  onClose?: () => void;
  /** Бартеры, которые открывает этот квест (кросс-линк Quest→Barter→Item). */
  barters?: QuestBarterLite[];
}

/**
 * Детальный разбор квеста: цели+чекбоксы, hero, трекер предметов, видео-гайд,
 * награды, toggle «выполнено» / pin. Общий рендер для дровера карты и полноэкранной страницы.
 */
export function QuestDetail({ task, variant = 'drawer', onClose, barters }: Props) {
  const isPage = variant === 'page';

  const [heroFailed, setHeroFailed]               = useState(false);
  const [checkedObjectives, setCheckedObjectives] = useState<Set<string>>(new Set());
  const autoCompletedRef                          = useRef(false);

  useEffect(() => {
    setHeroFailed(false);
    setCheckedObjectives(new Set());
    autoCompletedRef.current = false;
  }, [task.id]);

  const toggleObjective = (id: string) =>
    setCheckedObjectives(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const completedQuests = useQuestStore((s) => s.completedQuests);
  const toggleQuest     = useQuestStore((s) => s.toggleQuest);
  const pinnedQuests    = useQuestStore((s) => s.pinnedQuests);
  const togglePin       = useQuestStore((s) => s.togglePin);
  const itemProgress    = useQuestStore((s) => s.itemProgress);

  const dedupedObjectives = useMemo(
    () => task.objectives.filter((obj, i, arr) => arr.findIndex(o => o.id === obj.id) === i),
    [task],
  );

  useEffect(() => {
    const isNowCompleted = completedQuests.includes(task.id);

    const allChecked = dedupedObjectives.every(obj => checkedObjectives.has(obj.id));
    const allItemsCollected = dedupedObjectives
      .filter(obj => obj.__typename === 'TaskObjectiveItem')
      .every(obj => {
        const count = (obj as TaskObjectiveItem).count ?? 0;
        if (count === 0) return true;
        return (itemProgress[task.id]?.[obj.id] ?? 0) >= count;
      });
    const allDone = allChecked && allItemsCollected;

    if (!isNowCompleted && allDone) {
      autoCompletedRef.current = true;
      toggleQuest(task.id);
    } else if (isNowCompleted && !allDone && autoCompletedRef.current) {
      autoCompletedRef.current = false;
      toggleQuest(task.id);
    }
  }, [checkedObjectives, itemProgress, task, completedQuests, toggleQuest, dedupedObjectives]);

  const isCompleted = completedQuests.includes(task.id);
  const isPinned    = pinnedQuests.includes(task.id);
  const hasItemObjs = task.objectives.some((o) => o.__typename === 'TaskObjectiveItem');
  const hasRewards  =
    task.experience > 0 ||
    task.finishRewards.traderStanding.length > 0 ||
    task.finishRewards.items.length > 0;
  const showHero = !heroFailed;

  const headerImg = task.id.startsWith('story-')
    ? `/icons/eft/02-quests/${task.id}.svg`
    : traderImg(task.trader.normalizedName);

  // ── Header ──────────────────────────────────────────────────────────────
  const header = (
    <header className={`shrink-0 flex items-center gap-3 border-b border-lines-hover ${isPage ? 'px-6 h-16' : 'px-5 h-14'}`}>
      <img src={headerImg} alt={task.trader.name} width={isPage ? 32 : 28} height={isPage ? 32 : 28} className="rounded-xs shrink-0" />
      <span className="font-blender-medium text-xs uppercase tracking-widest text-text-primary truncate flex-1">
        {task.trader.name}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {task.minPlayerLevel > 0 && (
          <span className="text-xs font-blender-medium text-text-secondary shrink-0">УР. {task.minPlayerLevel}+</span>
        )}
        {task.lightkeeperRequired && (
          <span className="w-7 h-7 flex items-center justify-center rounded-xs shrink-0" style={{ background: 'color-mix(in srgb, var(--trader-lightkeeper) 10%, transparent)' }}>
            <span className="icon-bg icon-eft-profile-lightkeeper w-4 h-4" />
          </span>
        )}
        {task.kappaRequired && (
          <span className="w-7 h-7 flex items-center justify-center rounded-xs shrink-0" style={{ background: 'color-mix(in srgb, var(--color-nvg-green) 10%, transparent)' }}>
            <span className="icon-bg icon-eft-profile-kappa w-4 h-4" />
          </span>
        )}
        {isPage ? (
          <Link
            href={`/eft/questmap?quest=${task.id}`}
            title="Показать на карте"
            className="ml-1 flex items-center gap-1.5 h-7 px-2.5 rounded-xs border border-lines-hover text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary)/50 hover:text-(--primary)"
          >
            <MapIcon className="w-3.5 h-3.5" />
            Карта
          </Link>
        ) : (
          <>
            <Link
              href={`/eft/quests/task/${task.id}`}
              title="Открыть на отдельной странице"
              className="ml-1 shrink-0 h-7 w-7 flex items-center justify-center rounded-xs text-text-secondary transition-colors hover:text-(--primary)"
            >
              <Maximize2 className="w-4 h-4" />
            </Link>
            {onClose && (
              <button onClick={onClose} className="shrink-0 h-7 w-7 flex items-center justify-center transition-opacity hover:opacity-80" aria-label="Закрыть">
                <div className="flex h-3 w-4 items-center justify-center rounded-[1px] bg-danger-dim">
                  <div className="h-2 w-2 icon-mask icon-eft-profile-btn-close text-zinc-100" />
                </div>
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );

  // ── Hero ────────────────────────────────────────────────────────────────
  const hero = showHero ? (
    <div className={`relative overflow-hidden shrink-0 ${isPage ? 'h-56' : 'h-40'}`}>
      <img src={getQuestHeroImg(task.id)} alt={task.name} className="w-full h-full object-cover" onError={() => setHeroFailed(true)} />
      <div className="absolute inset-0 bg-linear-to-t from-black/90 to-transparent" />
      <h2 className={`absolute bottom-3 left-4 right-4 font-blender-medium uppercase tracking-widest text-text-primary leading-tight ${isPage ? 'text-lg' : 'text-sm'}`}>
        {task.name}
      </h2>
    </div>
  ) : (
    <h2 className={`px-5 py-4 font-blender-medium uppercase text-text-primary leading-tight border-b border-lines-hover ${isPage ? 'text-lg' : 'text-sm'}`}>
      {task.name}
    </h2>
  );

  // ── Sections ────────────────────────────────────────────────────────────
  const objectivesBlock = dedupedObjectives.length > 0 && (
    <div className={isPage ? 'px-6 py-6' : 'px-5 py-5'}>
      <div className="text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary mb-3">Задачи</div>
      <ul className="flex flex-col gap-4">
        {dedupedObjectives.map((obj) => (
          <ObjectiveRow key={obj.id} obj={obj} checked={checkedObjectives.has(obj.id)} onToggle={() => toggleObjective(obj.id)} />
        ))}
      </ul>
    </div>
  );

  const trackerBlock = hasItemObjs && (
    <div className={isPage ? 'px-6 py-6' : 'px-5 py-5'}>
      <div className="text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary mb-3">Трекер предметов</div>
      <QuestItemTracker task={task} />
    </div>
  );

  const guide = (questGuides as Record<string, { videoId: string | null }>)[task.id];
  const videoId = guide?.videoId ?? null;
  const videoSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}`
    : `https://www.youtube.com/embed?listType=search&list=fullkamen+${encodeURIComponent(task.name)}`;
  const videoBlock = (
    <div className={isPage ? 'px-6 py-6' : 'px-5 py-5'}>
      <div className="text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary mb-3">Видео-гайд</div>
      <div className="relative w-full aspect-video rounded-xs overflow-hidden bg-(--color-darkbase)">
        <iframe
          key={task.id}
          src={videoSrc}
          title={`Гайд: ${task.name}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    </div>
  );

  const rewardsBlock = hasRewards && (
    <div className={isPage ? 'px-6 py-6' : 'px-4 py-6'}>
      <div className="text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary mb-4">Награды</div>
      {task.experience > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <span className="icon-eft-profile-pvp icon-mask w-4 h-4 shrink-0 text-text-secondary" />
          <span className="text-xs font-blender-medium text-success">+{task.experience.toLocaleString('ru-RU')} XP</span>
        </div>
      )}
      {task.finishRewards.traderStanding.map((ts, i) => (
        <div key={i} className="flex items-center gap-3 mb-3">
          <img src={traderImg(ts.trader.normalizedName)} alt={ts.trader.name} width={16} height={16} className="rounded-xs shrink-0" />
          <span className="text-xs font-blender-medium text-success">+{ts.standing}</span>
        </div>
      ))}
      {task.finishRewards.items.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-2">
          {task.finishRewards.items.map((ri, i) => (
            <div key={i} className="relative w-12 h-12 bg-(--color-darkbase) border border-lines-hover rounded-xs flex items-center justify-center">
              <img src={ri.item.image512pxLink} alt={ri.item.shortName} width={48} height={48} className="w-full h-full object-contain p-1" />
              {ri.count > 1 && (
                <span className="absolute bottom-0.5 right-0.5 text-xs font-blender-medium text-text-primary leading-none bg-black/60 px-0.5 rounded-xs">×{ri.count}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Открывает бартеры (кросс-линк Quest → Barter → Item) ──────────────────
  const bartersBlock = barters && barters.length > 0 && (
    <div className={isPage ? 'px-6 py-6' : 'px-5 py-5'}>
      <div className="mb-3 flex items-center gap-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary">
        <ArrowLeftRight className="h-3.5 w-3.5" />
        Открывает бартеры
        <span className="text-text-muted">· {barters.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {barters.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-xs border border-lines-hover bg-(--color-darkbase) p-2">
            <img src={traderImg(b.trader.normalizedName)} alt={b.trader.name} width={18} height={18} className="shrink-0 rounded-xs" />
            <span className="font-blender-medium text-type-caption uppercase tracking-wide text-text-secondary">{b.trader.name}</span>
            <span className="font-blender-medium text-type-caption text-text-muted">LL{b.level}</span>
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            {b.rewardItems.map((rw) => {
              const tile = (
                <span className="relative flex h-9 w-9 items-center justify-center rounded-xs border border-lines-hover bg-(--color-base) transition-colors group-hover:border-(--primary)">
                  <img src={rw.image} alt={rw.shortName} className="h-8 w-8 object-contain p-0.5" />
                  {rw.count > 1 && (
                    <span className="absolute bottom-0 right-0.5 font-blender-medium text-type-caption leading-none text-(--primary)">×{rw.count}</span>
                  )}
                </span>
              );
              return rw.normalizedName ? (
                <Link key={rw.id} href={`/eft/items/item/${rw.normalizedName}`} title={rw.name} className="group">
                  {tile}
                </Link>
              ) : (
                <span key={rw.id} title={rw.name}>{tile}</span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Footer ──────────────────────────────────────────────────────────────
  const footer = (
    <div className={`shrink-0 border-t border-lines-hover flex items-center gap-2 ${isPage ? 'px-6 py-4' : 'px-5 h-14'}`}>
      <button
        className={`flex-1 h-9 rounded-sm text-xs font-blender-medium uppercase tracking-widest transition-colors duration-150 ${
          isCompleted
            ? 'bg-lines-hover/50 text-text-secondary hover:text-text-primary hover:bg-lines-hover'
            : 'bg-(--primary)/10 text-(--primary) hover:bg-(--primary)/20 border border-(--primary)/30'
        }`}
        onClick={() => toggleQuest(task.id)}
      >
        {isCompleted ? 'ОТМЕНИТЬ' : 'ВЫПОЛНЕНО'}
      </button>
      <button
        onClick={() => togglePin(task.id)}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-sm border transition-colors"
        style={isPinned ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : { borderColor: 'var(--color-lines-hover)' }}
      >
        <Paperclip className={`w-4 h-4 ${isPinned ? 'text-(--color-darkbase)' : 'text-text-secondary'}`} />
      </button>
    </div>
  );

  // ── Layout ──────────────────────────────────────────────────────────────
  if (isPage) {
    const traderColor = `var(${traderCssVar(task.trader.normalizedName)})`;
    const pageBg = `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 12%, transparent), rgba(0,0,0,0.85))`;
    return (
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-lg border border-lines-hover" style={{ background: pageBg }}>
        {header}
        {hero}
        {objectivesBlock}
        {trackerBlock}
        {videoBlock}
        {rewardsBlock}
        {bartersBlock}
        {footer}
      </div>
    );
  }

  return (
    <>
      {header}
      <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-compact">
        {hero}
        {objectivesBlock}
        {trackerBlock}
        {videoBlock}
        {rewardsBlock}
        {bartersBlock}
      </div>
      {footer}
    </>
  );
}
