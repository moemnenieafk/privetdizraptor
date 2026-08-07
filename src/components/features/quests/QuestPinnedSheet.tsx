'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useQuestMapUiStore } from '@/store/useQuestMapUiStore';
import { useQuestStore } from '@/store/useQuestStore';
import { TRADER_COLORS } from '@/data/traderColors';
import { traderImg } from '@/lib/trader-utils';
import type { TaskRaw } from '@/types/quest';

interface Props {
  tasks: TaskRaw[];
  /** Тап по строке — перелёт к ноде квеста на карте (шит закрывается). */
  onFocus: (task: TaskRaw) => void;
}

/**
 * Шит «Список заданий для отслеживания прогресса» (mobile) — закреплённые квесты.
 * Строки с трейдер-тинтом (как десктопная панель pinnedQuests и QuestRow поиска):
 * тап = перелёт к квесту, ✕ = снять закрепление. Данные — pinnedQuests из useQuestStore.
 */
export function QuestPinnedSheet({ tasks, onFocus }: Props) {
  const open = useQuestMapUiStore((s) => s.activeSheet === 'pinned');
  const close = useQuestMapUiStore((s) => s.closeSheet);

  const pinnedQuests = useQuestStore((s) => s.pinnedQuests);
  const togglePin = useQuestStore((s) => s.togglePin);

  const pinnedTasks = useMemo(
    () => pinnedQuests.flatMap((id) => {
      const t = tasks.find((x) => x.id === id);
      return t ? [t] : [];
    }),
    [pinnedQuests, tasks],
  );

  return (
    <BottomSheet open={open} title="Отслеживание прогресса" onClose={close}>
      <p className="mb-2 text-center font-blender-medium text-[10px] uppercase tracking-widest text-tactical-amber">
        Список заданий для отслеживания прогресса
      </p>

      {pinnedTasks.length === 0 ? (
        <p className="py-6 text-center font-blender-book text-sm text-text-muted">
          Нет закреплённых заданий. Закрепи квест на карте, чтобы следить за прогрессом.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 pb-2">
          {pinnedTasks.map((task) => {
            const tint = TRADER_COLORS[task.trader.normalizedName] ?? TRADER_COLORS.stories ?? '#555555';
            return (
              <li key={task.id}>
                <div
                  className="flex h-9 w-full items-center justify-between rounded border-[0.5px] px-3.5"
                  style={{
                    borderColor: `color-mix(in srgb, ${tint} 45%, transparent)`,
                    background: `radial-gradient(140% 160% at 0% 50%, color-mix(in srgb, ${tint} 38%, transparent), transparent 55%)`,
                  }}
                >
                  <button
                    onClick={() => {
                      onFocus(task);
                      close();
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <img
                      src={traderImg(task.trader.normalizedName)}
                      alt=""
                      width={16}
                      height={16}
                      className="size-4 shrink-0 rounded-xs border border-black/50 object-cover object-top"
                    />
                    <span className="min-w-0 truncate font-blender-medium text-xs text-text-primary">
                      {task.name}
                    </span>
                  </button>
                  <button
                    onClick={() => togglePin(task.id)}
                    aria-label="Снять закрепление"
                    className="ml-2 flex size-6 shrink-0 items-center justify-center text-text-secondary transition-colors hover:text-(--primary)"
                  >
                    <X className="size-4" strokeWidth={2} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
