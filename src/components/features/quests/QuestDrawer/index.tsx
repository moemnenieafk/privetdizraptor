'use client';

import { useRef } from 'react';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { QuestDetail } from '@/components/features/quests/QuestDetail';
import type { TaskRaw, QuestBarterLite } from '@/types/quest';
import { traderCssVar } from '@/lib/trader-utils';

interface Props {
  task: TaskRaw | null;
  onClose: () => void;
  /** Бартеры, открываемые выбранным квестом. */
  barters?: QuestBarterLite[];
}

/** Слайд-панель карты заданий: анимация + chrome, контент — общий `QuestDetail`. */
export function QuestDrawer({ task, onClose, barters }: Props) {
  // Держим последний таск, чтобы дорисовать панель во время exit-анимации.
  const lastTaskRef = useRef<TaskRaw | null>(null);
  if (task) lastTaskRef.current = task;
  const renderTask = task ?? lastTaskRef.current;

  const { isRendered, isVisible, modalRef } = useModalAnimation(task !== null, onClose);

  if (!isRendered) return null;

  const traderColor = renderTask ? `var(${traderCssVar(renderTask.trader.normalizedName)})` : 'transparent';
  const drawerBg    = `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 15%, transparent), rgba(0,0,0,0.9))`;

  return (
    <div
      ref={modalRef}
      style={{ background: drawerBg }}
      className={`absolute inset-y-0 right-0 z-50 w-87 border-l border-lines-hover flex flex-col transition-transform duration-200 ease-out backdrop-blur-[20px] ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {renderTask && <QuestDetail task={renderTask} variant="drawer" onClose={onClose} barters={barters} />}
    </div>
  );
}
