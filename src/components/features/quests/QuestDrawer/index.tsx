'use client';

import { useRef, useState, useEffect } from 'react';
import { Paperclip } from 'lucide-react';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useQuestStore } from '@/store/useQuestStore';
import { QuestItemTracker } from '@/components/features/quests/QuestItemTracker';
import type { TaskRaw, TaskObjective, TaskObjectiveItem } from '@/types/quest';
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
  task: TaskRaw | null;
  onClose: () => void;
}

export function QuestDrawer({ task, onClose }: Props) {
  const [heroFailed, setHeroFailed]           = useState(false);
  const [checkedObjectives, setCheckedObjectives] = useState<Set<string>>(new Set());

  const lastTaskRef       = useRef<TaskRaw | null>(null);
  const autoCompletedRef  = useRef(false);
  if (task) lastTaskRef.current = task;
  const renderTask = task ?? lastTaskRef.current;

  useEffect(() => {
    setHeroFailed(false);
    setCheckedObjectives(new Set());
    autoCompletedRef.current = false;
  }, [renderTask?.id]);

  const toggleObjective = (id: string) =>
    setCheckedObjectives(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const { isRendered, isVisible, modalRef } = useModalAnimation(task !== null, onClose);

  const completedQuests = useQuestStore((s) => s.completedQuests);
  const toggleQuest     = useQuestStore((s) => s.toggleQuest);
  const pinnedQuests    = useQuestStore((s) => s.pinnedQuests);
  const togglePin       = useQuestStore((s) => s.togglePin);
  const itemProgress    = useQuestStore((s) => s.itemProgress);

  useEffect(() => {
    if (!renderTask) return;

    const isNowCompleted = completedQuests.includes(renderTask.id);
    const deduped = renderTask.objectives.filter((obj, i, arr) => arr.findIndex(o => o.id === obj.id) === i);

    const allChecked = deduped.every(obj => checkedObjectives.has(obj.id));
    const allItemsCollected = deduped
      .filter(obj => obj.__typename === 'TaskObjectiveItem')
      .every(obj => {
        const count = (obj as TaskObjectiveItem).count ?? 0;
        if (count === 0) return true;
        return (itemProgress[renderTask.id]?.[obj.id] ?? 0) >= count;
      });
    const allDone = allChecked && allItemsCollected;

    if (!isNowCompleted && allDone) {
      autoCompletedRef.current = true;
      toggleQuest(renderTask.id);
    } else if (isNowCompleted && !allDone && autoCompletedRef.current) {
      autoCompletedRef.current = false;
      toggleQuest(renderTask.id);
    }
  }, [checkedObjectives, itemProgress, renderTask, completedQuests, toggleQuest]);

  if (!isRendered) return null;

  const traderColor = renderTask ? `var(${traderCssVar(renderTask.trader.normalizedName)})` : 'transparent';
  const drawerBg    = `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 15%, transparent), rgba(0,0,0,0.9))`;

  const isCompleted = renderTask ? completedQuests.includes(renderTask.id) : false;
  const isPinned    = renderTask ? pinnedQuests.includes(renderTask.id) : false;
  const hasItemObjs = renderTask?.objectives.some((o) => o.__typename === 'TaskObjectiveItem') ?? false;
  const hasRewards  = renderTask
    ? renderTask.experience > 0 ||
      renderTask.finishRewards.traderStanding.length > 0 ||
      renderTask.finishRewards.items.length > 0
    : false;
  const showHero = !heroFailed && !!renderTask;

  return (
    <div
      ref={modalRef}
      style={{ background: drawerBg }}
      className={`absolute inset-y-0 right-0 z-50 w-87 border-l border-lines-hover flex flex-col transition-transform duration-200 ease-out backdrop-blur-[20px] ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {renderTask && (
        <>
          {/* HEADER */}
          <header className="shrink-0 flex items-center gap-3 px-5 h-14 border-b border-lines-hover">
            <img
              src={renderTask.id.startsWith('story-')
                ? `/icons/eft/02-quests/${renderTask.id}.svg`
                : traderImg(renderTask.trader.normalizedName)
              }
              alt={renderTask.trader.name}
              width={28}
              height={28}
              className="rounded-xs shrink-0"
            />
            <span className="font-blender-medium text-xs uppercase tracking-widest text-text-primary truncate flex-1">
              {renderTask.trader.name}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {renderTask.minPlayerLevel > 0 && (
                <span className="text-xs font-blender-medium text-text-secondary shrink-0">
                  УР. {renderTask.minPlayerLevel}+
                </span>
              )}
              {renderTask.lightkeeperRequired && (
                <span
                  className="w-7 h-7 flex items-center justify-center rounded-xs shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--trader-lightkeeper) 10%, transparent)' }}
                >
                  <span className="icon-bg icon-eft-profile-lightkeeper w-4 h-4" />
                </span>
              )}
              {renderTask.kappaRequired && (
                <span
                  className="w-7 h-7 flex items-center justify-center rounded-xs shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--color-nvg-green) 10%, transparent)' }}
                >
                  <span className="icon-bg icon-eft-profile-kappa w-4 h-4" />
                </span>
              )}
            </div>
            <button onClick={onClose} className="shrink-0 h-7 w-7 flex items-center justify-center transition-opacity hover:opacity-80" aria-label="Закрыть">
              <div className="flex h-3 w-4 items-center justify-center rounded-[1px] bg-danger-dim">
                <div className="h-2 w-2 icon-mask icon-eft-profile-btn-close text-zinc-100" />
              </div>
            </button>
          </header>

          {/* OBJECTIVES + HERO */}
          <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-compact">
            {/* HERO */}
            {showHero ? (
              <div className="h-40 relative overflow-hidden shrink-0">
                <img
                  src={getQuestHeroImg(renderTask.id)}
                  alt={renderTask.name}
                  className="w-full h-full object-cover"
                  onError={() => setHeroFailed(true)}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/90 to-transparent" />
                <h2 className="absolute bottom-3 left-4 right-4 font-blender-medium uppercase tracking-widest text-sm text-text-primary leading-tight">
                  {renderTask.name}
                </h2>
              </div>
            ) : (
              <h2 className="px-5 py-4 font-blender-medium uppercase text-sm text-text-primary leading-tight border-b border-lines-hover">
                {renderTask.name}
              </h2>
            )}
            {renderTask.objectives.length > 0 && (
              <div className="px-5 py-5">
                <div className="text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary mb-3">
                  Задачи
                </div>
                <ul className="flex flex-col gap-4">
                  {renderTask.objectives.filter((obj, i, arr) => arr.findIndex(o => o.id === obj.id) === i).map((obj) => (
                    <ObjectiveRow key={obj.id} obj={obj} checked={checkedObjectives.has(obj.id)} onToggle={() => toggleObjective(obj.id)} />
                  ))}
                </ul>
              </div>
            )}

            {hasItemObjs && (
              <div className="px-5 py-5">
                <div className="text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary mb-3">
                  Трекер предметов
                </div>
                <QuestItemTracker task={renderTask} />
              </div>
            )}

            {(() => {
              const guide = (questGuides as Record<string, { videoId: string | null }>)[renderTask.id];
              const videoId = guide?.videoId ?? null;
              const src = videoId
                ? `https://www.youtube.com/embed/${videoId}`
                : `https://www.youtube.com/embed?listType=search&list=fullkamen+${encodeURIComponent(renderTask.name)}`;
              return (
                <div className="px-5 py-5">
                  <div className="text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary mb-3">
                    Видео-гайд
                  </div>
                  <div className="relative w-full aspect-video rounded-xs overflow-hidden bg-(--color-darkbase)">
                    <iframe
                      key={renderTask.id}
                      src={src}
                      title={`Гайд: ${renderTask.name}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full border-0"
                    />
                  </div>
                </div>
              );
            })()}
            {hasRewards && (
              <div className="px-4 py-6">
                <div className="text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary mb-4">
                  Награды
                </div>
                {renderTask.experience > 0 && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="icon-eft-profile-pvp icon-mask w-4 h-4 shrink-0 text-text-secondary" />
                    <span className="text-xs font-blender-medium text-success">
                      +{renderTask.experience.toLocaleString('ru-RU')} XP
                    </span>
                  </div>
                )}
                {renderTask.finishRewards.traderStanding.map((ts, i) => (
                  <div key={i} className="flex items-center gap-3 mb-3">
                    <img
                      src={traderImg(ts.trader.normalizedName)}
                      alt={ts.trader.name}
                      width={16}
                      height={16}
                      className="rounded-xs shrink-0"
                    />
                    <span className="text-xs font-blender-medium text-success">
                      +{ts.standing}
                    </span>
                  </div>
                ))}
                {renderTask.finishRewards.items.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-2">
                    {renderTask.finishRewards.items.map((ri, i) => (
                      <div
                        key={i}
                        className="relative w-12 h-12 bg-(--color-darkbase) border border-lines-hover rounded-xs flex items-center justify-center"
                      >
                        <img
                          src={ri.item.image512pxLink}
                          alt={ri.item.shortName}
                          width={48}
                          height={48}
                          className="w-full h-full object-contain p-1"
                        />
                        {ri.count > 1 && (
                          <span className="absolute bottom-0.5 right-0.5 text-xs font-blender-medium text-text-primary leading-none bg-black/60 px-0.5 rounded-xs">
                            ×{ri.count}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="shrink-0 border-t border-lines-hover px-5 h-14 flex items-center gap-2">
            <button
              className={`flex-1 h-9 rounded-sm text-xs font-blender-medium uppercase tracking-widest transition-colors duration-150 ${
                isCompleted
                  ? 'bg-lines-hover/50 text-text-secondary hover:text-text-primary hover:bg-lines-hover'
                  : 'bg-(--primary)/10 text-(--primary) hover:bg-(--primary)/20 border border-(--primary)/30'
              }`}
              onClick={() => toggleQuest(renderTask.id)}
            >
              {isCompleted ? 'ОТМЕНИТЬ' : 'ВЫПОЛНЕНО'}
            </button>
            <button
              onClick={() => togglePin(renderTask.id)}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-sm border transition-colors"
              style={isPinned
                ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }
                : { borderColor: 'var(--color-lines-hover)' }
              }
            >
              <Paperclip className={`w-4 h-4 ${isPinned ? 'text-(--color-darkbase)' : 'text-text-secondary'}`} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
