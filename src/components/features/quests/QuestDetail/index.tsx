'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Paperclip, Maximize2, Map as MapIcon, MapPin, ChevronRight, ListChecks } from 'lucide-react';
import { useQuestStore, isObjectiveComplete } from '@/store/useQuestStore';
import { isCollectorTask, COLLECTOR_TRACKER_HREF } from '@/lib/quest-constants';
import { QuestItemTracker } from '@/components/features/quests/QuestItemTracker';
import { FoundInRaidBadge } from '@/components/ui/FoundInRaidBadge';
import type { TaskRaw, TaskObjective, TaskObjectiveItem, QuestBarterLite } from '@/types/quest';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { isFirStashObjective, syncStashDelta } from '@/lib/quest-stash-sync';
import ITEM_BG from '@/data/quests/item-backgrounds.json';
import { getQuestHeroImg } from '@/lib/quest-utils';

// Тарковский фон ячейки предмета по id (награды/цели): обычные — свой цвет, квест → #686628.
const questItemBg = (id: string): string => getTarkovBackgroundColor((ITEM_BG as Record<string, string>)[id]);
import { firstInteractiveMapSlug } from '@/lib/quest-map-link';
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

function ObjectiveRow({ obj, checked, onComplete, onReverse, onLocate }: { obj: TaskObjective; checked: boolean; onComplete: () => void; onReverse: () => void; onLocate?: () => void }) {
  const iconCls = getObjIcon(obj.__typename, obj.type);
  const reverse = (e: { preventDefault: () => void }) => { e.preventDefault(); onReverse(); };
  return (
    <li className={`flex items-start gap-3 ${obj.optional ? 'opacity-50 italic' : ''}`}>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <span
            onClick={onComplete}
            onContextMenu={reverse}
            title="ЛКМ — выполнить · ПКМ — отменить"
            className={`text-base font-blender-book leading-snug flex-1 cursor-pointer select-none transition-colors duration-150 ${
              checked ? 'line-through text-success' : 'text-text-primary'
            }`}
          >
            {obj.description}
          </span>
          <div className="flex items-start gap-1.5 shrink-0 pt-0.5">
            {obj.optional && (
              <span className="text-type-caption font-blender-medium uppercase not-italic text-text-secondary border border-lines-hover rounded-xs px-1 py-0.5">
                НЕ ОБЯ.
              </span>
            )}
            {/* Map-пин объекта (только drawer карты): перелёт к зоне квеста + сворачивание шита. */}
            {onLocate ? (
              <button
                type="button"
                onClick={onLocate}
                title="Показать на карте"
                aria-label="Показать на карте"
                className={`shrink-0 transition-opacity hover:opacity-70 ${checked ? 'text-success' : 'text-text-primary'}`}
              >
                <MapPin className="w-4 h-4" />
              </button>
            ) : (
              <span
                onClick={onComplete}
                onContextMenu={reverse}
                title="ЛКМ — выполнить · ПКМ — отменить"
                className={`${iconCls} icon-mask w-4 h-4 shrink-0 cursor-pointer transition-colors duration-150 ${
                  checked ? 'text-success' : 'text-text-secondary'
                }`}
              />
            )}
          </div>
        </div>

        {obj.__typename === 'TaskObjectiveItem' && obj.item && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs font-blender-medium text-text-secondary">{obj.item.shortName}</span>
            {obj.count != null && obj.count > 1 && (
              <span className="text-xs font-blender-medium text-text-secondary">× {obj.count}</span>
            )}
            {obj.foundInRaid && <FoundInRaidBadge />}
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
              className="rounded-xs shrink-0"
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
  /** Квесты, которые открывает этот (инверсия taskRequirements) — блок «Открывает задания». Обычно со страницы. */
  unlocks?: Array<{ id: string; name: string; trader: { name: string; normalizedName: string } }>;
  /**
   * Только drawer карты (M6): у объектов появляется map-пин, тап зовёт этот колбэк
   * (перелёт к зоне квеста + сворачивание шита). Не передан — пины не рисуются.
   * Гранулярность — на уровне квеста: в зеркале нет координат отдельных объектов
   * (TaskObjective без x/z), поэтому все пины ведут к одной зоне квеста.
   */
  onLocate?: () => void;
}

/**
 * Детальный разбор квеста: цели+чекбоксы, hero, трекер предметов, видео-гайд,
 * награды, toggle «выполнено» / pin. Общий рендер для дровера карты и полноэкранной страницы.
 */
export function QuestDetail({ task, variant = 'drawer', onClose, barters, unlocks, onLocate }: Props) {
  const isPage = variant === 'page';

  const [heroFailed, setHeroFailed] = useState(false);
  const autoCompletedRef            = useRef(false);

  useEffect(() => {
    setHeroFailed(false);
    autoCompletedRef.current = false;
  }, [task.id]);

  const completedQuests        = useQuestStore((s) => s.completedQuests);
  const toggleQuest            = useQuestStore((s) => s.toggleQuest);
  const setQuestDone           = useQuestStore((s) => s.setQuestDone);
  const pinnedQuests           = useQuestStore((s) => s.pinnedQuests);
  const togglePin              = useQuestStore((s) => s.togglePin);
  const itemProgress           = useQuestStore((s) => s.itemProgress);
  const checkedObjectives      = useQuestStore((s) => s.checkedObjectives);
  const setItemCount           = useQuestStore((s) => s.setItemCount);
  const toggleCheckedObjective = useQuestStore((s) => s.toggleCheckedObjective);

  // Направленно (как в QuestNode): ЛКМ — выполнить цель, ПКМ — отменить.
  // item — заполнить/обнулить счётчик (двусторонняя связка с трекером); прочие — галка.
  const completeObjective = (obj: TaskObjective) => {
    if (obj.__typename === 'TaskObjectiveItem') {
      const cur = itemProgress[task.id]?.[obj.id] ?? 0;
      const count = (obj as TaskObjectiveItem).count ?? 0;
      setItemCount(task.id, obj.id, count);
      if (obj.item && isFirStashObjective(obj)) syncStashDelta(obj.item.id, count - cur); // FiR → в схрон
    } else if (!(checkedObjectives[task.id]?.includes(obj.id))) {
      toggleCheckedObjective(task.id, obj.id);
    }
  };
  const reverseObjective = (obj: TaskObjective) => {
    if (obj.__typename === 'TaskObjectiveItem') {
      const cur = itemProgress[task.id]?.[obj.id] ?? 0;
      setItemCount(task.id, obj.id, 0);
      if (obj.item && isFirStashObjective(obj)) syncStashDelta(obj.item.id, -cur); // убрать из схрона
    } else if (checkedObjectives[task.id]?.includes(obj.id)) {
      toggleCheckedObjective(task.id, obj.id);
    }
  };

  const dedupedObjectives = useMemo(
    () => task.objectives.filter((obj, i, arr) => arr.findIndex(o => o.id === obj.id) === i),
    [task],
  );

  useEffect(() => {
    const isNowCompleted = completedQuests.includes(task.id);
    const allDone =
      dedupedObjectives.length > 0 &&
      dedupedObjectives.every((obj) => isObjectiveComplete(obj, task.id, itemProgress, checkedObjectives));

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

  // Карта локации с интерактивной подложкой (для кнопки «Локация» → перелёт+подсветка зоны).
  const locationSlug = firstInteractiveMapSlug(task);

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
          <>
            <Link
              href={`/eft/questmap?quest=${task.id}`}
              title="Показать в карте заданий"
              className="ml-1 flex items-center gap-1.5 h-7 px-2.5 rounded-xs border border-lines-hover text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary)/50 hover:text-(--primary)"
            >
              <MapIcon className="w-3.5 h-3.5" />
              Карта
            </Link>
            {locationSlug && (
              <Link
                href={`/eft/maps/${locationSlug}?quest=${task.id}`}
                title="Показать зону на карте локации"
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-xs border border-lines-hover text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary)/50 hover:text-(--primary)"
              >
                <MapPin className="w-3.5 h-3.5" />
                Локация
              </Link>
            )}
          </>
        ) : (
          <>
            {locationSlug && (
              <Link
                href={`/eft/maps/${locationSlug}?quest=${task.id}`}
                title="Показать зону на карте локации"
                className="ml-1 shrink-0 h-7 w-7 flex items-center justify-center rounded-xs text-text-secondary transition-colors hover:text-(--primary)"
              >
                <MapPin className="w-4 h-4" />
              </Link>
            )}
            <Link
              href={`/eft/quests/task/${task.id}`}
              title="Открыть на отдельной странице"
              className="shrink-0 h-7 w-7 flex items-center justify-center rounded-xs text-text-secondary transition-colors hover:text-(--primary)"
            >
              <Maximize2 className="w-4 h-4" />
            </Link>
            {onClose && (
              <button onClick={onClose} className="shrink-0 h-7 w-7 flex items-center justify-center transition-opacity hover:opacity-80" aria-label="Закрыть">
                <div className="flex h-3 w-4 items-center justify-center rounded-xs bg-danger-dim">
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
          <ObjectiveRow
            key={obj.id}
            obj={obj}
            checked={isObjectiveComplete(obj, task.id, itemProgress, checkedObjectives)}
            onComplete={() => completeObjective(obj)}
            onReverse={() => reverseObjective(obj)}
            onLocate={!isPage && onLocate ? onLocate : undefined}
          />
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

  // Награды крупно (спека «редизайн шелла», элемент F): строки «иконка/портрет · название · значение».
  const rewardRow = 'flex items-center gap-3';
  const rewardTile = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xs border border-lines-hover bg-(--color-darkbase)';
  const rewardsBlock = hasRewards && (
    <div className={isPage ? 'px-6 py-6' : 'px-5 py-5'}>
      <div className="text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary mb-4">Награды</div>
      <div className="flex flex-col gap-2.5">
        {task.experience > 0 && (
          <div className={rewardRow}>
            <span className={rewardTile}><span className="icon-eft-profile-pvp icon-mask h-5 w-5 text-text-secondary" /></span>
            <span className="flex-1 font-blender-medium text-sm uppercase tracking-wide text-text-primary">Опыт ЧВК</span>
            <span className="shrink-0 font-blender-medium text-sm text-(--primary)">+{task.experience.toLocaleString('ru-RU')} XP</span>
          </div>
        )}
        {task.finishRewards.traderStanding.map((ts, i) => (
          <div key={`ts-${i}`} className={rewardRow}>
            <img src={traderImg(ts.trader.normalizedName)} alt={ts.trader.name} width={40} height={40} className="h-10 w-10 shrink-0 rounded-xs object-cover object-top" />
            <span className="flex-1 truncate font-blender-medium text-sm uppercase tracking-wide text-text-primary">{ts.trader.name}</span>
            <span className={`shrink-0 font-blender-medium text-sm ${ts.standing >= 0 ? 'text-success' : 'text-danger'}`}>
              {ts.standing >= 0 ? '+' : ''}{ts.standing}
            </span>
          </div>
        ))}
        {task.finishRewards.items.map((ri, i) => (
          <div key={`it-${i}`} className={rewardRow}>
            {/* Тайл награды с тарковским фоном ячейки (редкость предмета) */}
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-(--color-base)">
              <span aria-hidden className="absolute inset-0 bg-(--color-darkbase)" />
              <span aria-hidden className="absolute inset-0" style={{ backgroundColor: questItemBg(ri.item.id) }} />
              <span aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_8px_rgba(0,0,0,0.7)]" />
              <img src={ri.item.image512pxLink} alt={ri.item.shortName} className="relative z-10 h-full w-full object-contain p-1" />
            </span>
            <span className="min-w-0 flex-1 truncate font-blender-book text-sm text-text-primary">{ri.item.name}</span>
            {ri.count > 1 && <span className="shrink-0 font-blender-medium text-sm text-text-secondary">×{ri.count.toLocaleString('ru-RU')}</span>}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Открывает бартеры (кросс-линк Quest → Barter → Item) ──────────────────
  const bartersBlock = barters && barters.length > 0 && (
    <div className={isPage ? 'px-6 py-6' : 'px-5 py-5'}>
      <div className="mb-3 flex items-center gap-2 text-type-caption font-blender-medium uppercase tracking-widest text-nvg-green">
        <span className="icon-eft-prog-barter h-3.5 w-3.5 shrink-0 bg-nvg-green mask-contain mask-center mask-no-repeat" />
        Открывает бартеры
        <span className="text-text-muted">· {barters.length}</span>
      </div>
      <div className="flex flex-col gap-3">
        {barters.map((b) => (
          <div key={b.id} className="flex items-center gap-2.5">
            {/* Крупнее: аватар торговца 32px + иконка лояльности 20px (без подложки/обводки строки) */}
            <img src={traderImg(b.trader.normalizedName)} alt={b.trader.name} width={32} height={32} className="h-8 w-8 shrink-0 rounded-xs object-cover" />
            <span
              className={`icon-eft-profile-rep-${Math.min(Math.max(b.level, 1), 4)} h-5 w-5 shrink-0 bg-text-muted mask-contain mask-center mask-no-repeat`}
              title={`Уровень лояльности ${b.level}`}
              aria-label={`Уровень лояльности ${b.level}`}
            />
            <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
            {b.rewardItems.map((rw) => {
              const inner = (
                <>
                  {/* Тайл предмета с тарковским фоном (редкость) + ×N в углу */}
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-(--color-base)">
                    <span aria-hidden className="absolute inset-0 bg-(--color-darkbase)" />
                    <span aria-hidden className="absolute inset-0" style={{ backgroundColor: getTarkovBackgroundColor(rw.backgroundColor) }} />
                    <span aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_8px_rgba(0,0,0,0.7)]" />
                    <img src={rw.image} alt={rw.shortName} className="relative z-10 h-full w-full object-contain p-1" />
                    {rw.count > 1 && (
                      <span className="absolute bottom-0 right-0 z-20 rounded-tl-xs bg-(--color-darkbase)/90 px-1 font-blender-medium text-[0.625rem] leading-tight tabular-nums text-text-primary">×{rw.count}</span>
                    )}
                  </span>
                  {/* Короткое имя предмета справа */}
                  <span className="min-w-0 flex-1 truncate font-blender-medium text-type-caption uppercase tracking-wide text-text-secondary group-hover:text-(--primary)">
                    {rw.shortName}
                  </span>
                </>
              );
              return rw.normalizedName ? (
                <Link key={rw.id} href={`/eft/items/item/${rw.normalizedName}`} title={rw.name} className="group flex min-w-0 flex-1 items-center gap-2">
                  {inner}
                </Link>
              ) : (
                <div key={rw.id} title={rw.name} className="flex min-w-0 flex-1 items-center gap-2">{inner}</div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Открывает задания (инверсия taskRequirements: какие квесты открывает этот) ──
  const unlocksBlock = unlocks && unlocks.length > 0 && (
    <div className={isPage ? 'px-6 py-6' : 'px-5 py-5'}>
      <div className="mb-3 flex items-center gap-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary">
        <ChevronRight className="h-3.5 w-3.5" />
        Открывает задания
        <span className="text-text-muted">· {unlocks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {unlocks.map((q) => (
          <Link
            key={q.id}
            href={`/eft/quests/task/${q.id}`}
            title={q.name}
            className="group flex items-center gap-2 rounded-xs border border-lines-hover bg-(--color-darkbase) p-2 transition-colors hover:border-(--primary)/50"
          >
            <img src={traderImg(q.trader.normalizedName)} alt={q.trader.name} width={18} height={18} className="shrink-0 rounded-xs" />
            <span className="min-w-0 flex-1 truncate font-blender-book text-type-caption text-text-secondary group-hover:text-text-primary">
              {q.name}
            </span>
            <span className="shrink-0 font-blender-medium text-type-caption uppercase tracking-wide text-text-muted">
              {q.trader.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );

  // ── Кросс-линк на трекер Kappa — только на «Коллекционере» (карта заданий + страница квеста) ──
  const collectorBlock = isCollectorTask(task) && (
    <div className={isPage ? 'px-6 py-6' : 'px-5 py-5'}>
      <div className="mb-3 flex items-center gap-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary">
        <ListChecks className="h-3.5 w-3.5" />
        Трекер Kappa
      </div>
      <Link
        href={COLLECTOR_TRACKER_HREF}
        className="group flex items-center gap-2 rounded-xs border border-(--primary)/40 bg-(--primary)/10 p-2 transition-colors hover:border-(--primary)/70 hover:bg-(--primary)/15"
      >
        <span className="min-w-0 flex-1 truncate font-blender-medium text-type-caption uppercase tracking-widest text-(--primary)">
          Открыть трекер Коллекционера
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-(--primary)" />
      </Link>
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
        onClick={() => setQuestDone(task, !isCompleted)}
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
        {unlocksBlock}
        {collectorBlock}
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
        {unlocksBlock}
        {collectorBlock}
      </div>
      {footer}
    </>
  );
}
