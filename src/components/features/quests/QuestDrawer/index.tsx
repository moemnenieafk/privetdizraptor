'use client';

import { useRef } from 'react';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useQuestStore } from '@/store/useQuestStore';
import { QuestItemTracker } from '@/components/features/quests/QuestItemTracker';
import type { TaskRaw, TaskObjective } from '@/types/quest';

const TRADER_SLUG: Record<string, string> = { 'btr-driver': 'btrdriver' };
const traderImg = (n: string) => `/images/traders/eft/${TRADER_SLUG[n] ?? n}.webp`;

// Маппинг __typename → CSS icon class; fallback на icon-eft-quests-active
const OBJECTIVE_ICON: Record<string, string> = {
  TaskObjectiveItem:        'icon-eft-quests-active',
  TaskObjectiveMark:        'icon-eft-quests-active',
  TaskObjectiveShoot:       'icon-eft-quests-active',
  TaskObjectiveLocation:    'icon-eft-quests-active',
  TaskObjectivePlayerLevel: 'icon-eft-profile-level',
  TaskObjectiveTraderLevel: 'icon-eft-quests-active',
};

function getObjIcon(typename?: string): string {
  return typename ? (OBJECTIVE_ICON[typename] ?? 'icon-eft-quests-active') : 'icon-eft-quests-active';
}

function ObjectiveRow({ obj }: { obj: TaskObjective }) {
  const iconCls = getObjIcon(obj.__typename);
  return (
    <li className={`flex items-start gap-2 ${obj.optional ? 'opacity-50 italic' : ''}`}>
      <span className={`icon-bg ${iconCls} w-3 h-3 shrink-0 mt-0.5 text-text-muted`} />
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-blender-book text-text-primary leading-snug">
            {obj.description}
          </span>
          {obj.optional && (
            <span className="shrink-0 text-[8px] font-blender-medium uppercase not-italic text-text-muted border border-lines-hover rounded-xs px-1 py-0.5">
              НЕ ОБЯ.
            </span>
          )}
        </div>

        {/* TaskObjectiveItem — shortName + count + FiR */}
        {obj.__typename === 'TaskObjectiveItem' && obj.item && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[9px] font-blender-medium text-text-muted">{obj.item.shortName}</span>
            {obj.count != null && obj.count > 1 && (
              <span className="text-[9px] font-blender-medium text-text-muted">× {obj.count}</span>
            )}
            {obj.foundInRaid && (
              <span className="text-[9px] font-blender-medium uppercase tracking-widest text-danger bg-danger/10 px-1 rounded-xs">
                FIR
              </span>
            )}
          </div>
        )}

        {/* TaskObjectiveShoot — times / target / distance / shotType */}
        {obj.__typename === 'TaskObjectiveShoot' && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {obj.times != null && obj.times > 1 && (
              <span className="text-[9px] font-blender-medium text-text-muted">{obj.times}×</span>
            )}
            {obj.target && (
              <span className="text-[9px] font-blender-medium text-text-muted">{obj.target}</span>
            )}
            {obj.distance != null && (
              <span className="text-[9px] font-blender-medium text-text-muted">{obj.distance}м</span>
            )}
            {obj.shotType && (
              <span className="text-[9px] font-blender-medium text-text-muted">{obj.shotType}</span>
            )}
          </div>
        )}

        {/* TaskObjectiveTraderLevel — trader img + name + level */}
        {obj.__typename === 'TaskObjectiveTraderLevel' && obj.trader && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <img
              src={traderImg(obj.trader.normalizedName)}
              alt={obj.trader.name}
              width={12}
              height={12}
              className="rounded-[1px] shrink-0"
            />
            <span className="text-[9px] font-blender-medium text-text-muted">
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
  const lastTaskRef = useRef<TaskRaw | null>(null);
  if (task) lastTaskRef.current = task;
  const renderTask = task ?? lastTaskRef.current;

  const { isRendered, isVisible, modalRef } = useModalAnimation(task !== null, onClose);

  const completedQuests = useQuestStore((s) => s.completedQuests);
  const toggleQuest     = useQuestStore((s) => s.toggleQuest);

  if (!isRendered) return null;

  const isCompleted = renderTask ? completedQuests.includes(renderTask.id) : false;
  const hasItemObjs = renderTask?.objectives.some((o) => o.__typename === 'TaskObjectiveItem') ?? false;
  const hasRewards  = renderTask
    ? renderTask.experience > 0 ||
      renderTask.finishRewards.traderStanding.length > 0 ||
      renderTask.finishRewards.items.length > 0
    : false;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={modalRef}
        className={`fixed inset-y-0 right-0 z-50 w-105 max-w-[90vw] bg-card-menu border-l border-lines-hover flex flex-col transform transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {renderTask && (
          <>
            {/* ── Header ── */}
            <div className="flex items-start gap-3 p-4 border-b border-lines-hover shrink-0">
              <img
                src={traderImg(renderTask.trader.normalizedName)}
                alt={renderTask.trader.name}
                width={32}
                height={32}
                className="rounded-xs shrink-0 mt-0.5"
              />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[10px] font-blender-medium uppercase tracking-widest text-text-muted">
                  {renderTask.trader.name}
                </span>
                <span className="text-[13px] font-blender-medium uppercase leading-tight text-text-primary mt-0.5">
                  {renderTask.name}
                </span>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {renderTask.minPlayerLevel > 0 && (
                    <span className="text-[9px] font-blender-medium uppercase tracking-widest text-text-muted bg-(--color-darkbase) px-1.5 py-0.5 rounded-xs">
                      ур. {renderTask.minPlayerLevel}+
                    </span>
                  )}
                  {renderTask.kappaRequired && (
                    <span className="flex items-center gap-1 text-[9px] font-blender-medium uppercase tracking-widest text-(--primary)">
                      <span className="icon-bg icon-eft-profile-kappa w-3 h-3 shrink-0" />
                      Каппа
                    </span>
                  )}
                  {renderTask.lightkeeperRequired && (
                    <span className="flex items-center gap-1 text-[9px] font-blender-medium uppercase tracking-widest text-nvg-green">
                      <span className="icon-bg icon-eft-profile-lightkeeper w-3 h-3 shrink-0" />
                      Маяк
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-xs text-[14px] text-text-muted hover:text-text-primary hover:bg-lines-hover transition-colors duration-150"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto flex flex-col">

              {/* Section: Задачи */}
              {renderTask.objectives.length > 0 && (
                <div className="px-4 pt-3 pb-4">
                  <div className="text-[9px] font-blender-medium uppercase tracking-widest text-text-muted pb-1.5">
                    Задачи
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {renderTask.objectives.map((obj) => (
                      <ObjectiveRow key={obj.id} obj={obj} />
                    ))}
                  </ul>
                </div>
              )}

              {/* Section: Трекер предметов (UX-3) */}
              {hasItemObjs && (
                <div className="border-t border-lines-hover px-4 pt-3 pb-4">
                  <div className="text-[9px] font-blender-medium uppercase tracking-widest text-text-muted mb-2">
                    Трекер предметов
                  </div>
                  <QuestItemTracker task={renderTask} />
                </div>
              )}

              {/* Section: Награды */}
              {hasRewards && (
                <div className="border-t border-lines-hover px-4 pt-3 pb-4">
                  <div className="text-[9px] font-blender-medium uppercase tracking-widest text-text-muted mb-2">
                    Награды
                  </div>

                  {/* XP */}
                  {renderTask.experience > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="icon-bg icon-eft-profile-level w-3.5 h-3.5 shrink-0 text-text-muted" />
                      <span className="text-[12px] font-blender-medium text-(--primary)">
                        +{renderTask.experience.toLocaleString('ru-RU')} XP
                      </span>
                    </div>
                  )}

                  {/* Trader standing */}
                  {renderTask.finishRewards.traderStanding.map((ts, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <img
                        src={traderImg(ts.trader.normalizedName)}
                        alt={ts.trader.name}
                        width={16}
                        height={16}
                        className="rounded-xs shrink-0"
                      />
                      <span className="text-[10px] font-blender-medium text-text-muted">
                        {ts.trader.name}
                      </span>
                      <span className="text-[11px] font-blender-medium text-success">
                        +{ts.standing}
                      </span>
                    </div>
                  ))}

                  {/* Reward items — горизонтальный скролл */}
                  {renderTask.finishRewards.items.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 mt-1">
                      {renderTask.finishRewards.items.map((ri, i) => (
                        <div
                          key={i}
                          className="relative shrink-0 w-12 h-12 bg-(--color-darkbase) border border-lines-hover rounded-xs flex items-center justify-center"
                        >
                          <img
                            src={ri.item.image512pxLink}
                            alt={ri.item.shortName}
                            width={40}
                            height={40}
                            className="object-contain"
                          />
                          {ri.count > 1 && (
                            <span className="absolute bottom-0.5 right-0.5 text-[8px] font-blender-medium text-text-primary leading-none">
                              {ri.count}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Footer: toggle button ── */}
            <div className="shrink-0 border-t border-lines-hover p-3">
              <button
                className={`w-full h-9 rounded-xs text-[10px] font-blender-medium uppercase tracking-wider transition-colors duration-150 ${
                  isCompleted
                    ? 'bg-lines-hover/50 text-text-muted hover:text-text-primary hover:bg-lines-hover'
                    : 'bg-(--primary)/10 text-(--primary) hover:bg-(--primary)/20 border border-(--primary)/30'
                }`}
                onClick={() => toggleQuest(renderTask.id)}
              >
                {isCompleted ? '↩ ОТМЕНИТЬ ВЫПОЛНЕНИЕ' : '✓ ОТМЕТИТЬ ВЫПОЛНЕННЫМ'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
