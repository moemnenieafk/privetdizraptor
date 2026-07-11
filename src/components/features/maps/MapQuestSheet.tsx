'use client';

import { useState } from 'react';
import { Eye, EyeOff, ChevronRight } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useMapUiStore } from '@/store/useMapUiStore';

export interface MapQuest {
  id: string;
  name: string;
  trader: string;
  done: boolean;
  visible: boolean;
}

interface MapQuestSheetProps {
  quests: MapQuest[];
  onToggleVisible: (id: string, next: boolean) => void;
  onOpenQuest: (id: string) => void;
}

export function MapQuestSheet({ quests, onToggleVisible, onOpenQuest }: MapQuestSheetProps) {
  const open = useMapUiStore((s) => s.activeSheet === 'quests');
  const close = useMapUiStore((s) => s.closeSheet);
  const [hideDone, setHideDone] = useState(true);

  const list = hideDone ? quests.filter((qq) => !qq.done) : quests;

  return (
    <BottomSheet open={open} title="Задания" onClose={close}>
      <button
        onClick={() => setHideDone((v) => !v)}
        className="mb-3 flex h-9 items-center gap-2 rounded-xs border border-(--border) bg-(--surface-raised) px-3 font-blender-medium text-xs uppercase tracking-widest text-(--text-muted)"
      >
        {hideDone ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
        {hideDone ? 'Скрыты выполненные' : 'Показаны все'}
      </button>

      <ul className="flex flex-col gap-1 pb-2">
        {list.map((quest) => (
          <li key={quest.id} className="flex items-center gap-1">
            <button
              aria-label={quest.visible ? 'Скрыть на карте' : 'Показать на карте'}
              onClick={() => onToggleVisible(quest.id, !quest.visible)}
              className={`flex size-11 shrink-0 items-center justify-center rounded-xs ${quest.visible ? 'text-(--primary)' : 'text-(--text-muted)'}`}
            >
              {quest.visible ? <Eye className="size-5" strokeWidth={2} /> : <EyeOff className="size-5" strokeWidth={2} />}
            </button>
            <button
              onClick={() => onOpenQuest(quest.id)}
              className={`flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xs border px-3 ${quest.done ? 'border-(--border) bg-(--surface)' : 'border-(--border) bg-(--surface-raised)'}`}
            >
              <span className="flex min-w-0 flex-1 flex-col text-left">
                <span className={`truncate font-blender-book text-sm ${quest.done ? 'text-(--text-muted) line-through' : 'text-(--text)'}`}>
                  {quest.name}
                </span>
                <span className="font-blender-medium text-xs uppercase tracking-widest text-(--text-muted)">{quest.trader}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-(--text-muted)" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
