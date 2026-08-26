'use client';

import { useEffect, useMemo } from 'react';
import { QuestDetail } from '@/components/features/quests/QuestDetail';
import { useMapUiStore } from '@/store/useMapUiStore';
import { traderCssVar } from '@/lib/trader-utils';
import type { TaskRaw } from '@/types/quest';

interface Props {
  /** Полные таски квестов карты — для резолва выбранного квеста (EFT_QUESTS на клиент не грузим). */
  questTasks: TaskRaw[];
}

/**
 * Десктопная панель «Подробности задания» (`hidden lg:flex`) — сиблинг мобильного
 * MapQuestDetailSheet (`lg:hidden`): вместе дают ОДНУ панель на брейкпоинт. Store-driven из
 * общего канала (`activeSheet==='questDetail'` + `selectedQuestId`) — открывается и из карточки
 * квест-маркера, и из drawer «Поиск на локации», и из шита заданий. Рендерит
 * `QuestDetail variant="drawer"` слева поверх карты (по образцу десктоп-панели MapSearchDrawer:
 * `lg:w-87`, трейдер-тинт фон). Закрытие сбрасывает выбранный квест (closeSheet).
 */
export function MapQuestDetailDesktop({ questTasks }: Props) {
  const open = useMapUiStore((s) => s.activeSheet === 'questDetail');
  const selectedQuestId = useMapUiStore((s) => s.selectedQuestId);
  const closeSheet = useMapUiStore((s) => s.closeSheet);
  // Drawer «Поиск на локации» открыт → деталь стоит РЯДОМ со списком (master-detail, lg:left-87),
  // а не накрывает его; клик по маркеру (drawer закрыт) → у левого края (left-0).
  const searchOpen = useMapUiStore((s) => s.searchOpen);

  const taskById = useMemo(() => new Map(questTasks.map((t) => [t.id, t])), [questTasks]);
  const task = selectedQuestId ? (taskById.get(selectedQuestId) ?? null) : null;

  // Закрытие по Escape, пока открыта (десктоп-панель — как master-detail в drawer'е поиска).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeSheet]);

  if (!open || !task) return null;

  return (
    <div
      className={`absolute inset-y-0 z-[545] hidden max-h-none w-87 flex-col border-r border-lines-hover backdrop-blur-md lg:flex ${searchOpen ? 'left-87' : 'left-0'}`}
      style={{
        background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, var(${traderCssVar(task.trader.normalizedName)}, transparent) 15%, transparent), rgba(0,0,0,0.92))`,
      }}
    >
      <QuestDetail task={task} variant="drawer" onClose={closeSheet} />
    </div>
  );
}
