'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, MapPin, ExternalLink } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useMapUiStore } from '@/store/useMapUiStore';
import { useQuestStore } from '@/store/useQuestStore';
import type { MapQuestLite } from './map-frame-types';

interface MapQuestSheetProps {
  quests: MapQuestLite[];
}

/**
 * Drawer заданий локации (mobile). Тап по строке → drawer деталей квеста ПОВЕРХ карты (M6:
 * QuestDetail + видео + map-пины, MapQuestDetailSheet); стрелка → карта заданий (/eft/questmap).
 * Статус выполнения — из useQuestStore.completedQuests; пройденные можно скрыть.
 */
export function MapQuestSheet({ quests }: MapQuestSheetProps) {
  const open = useMapUiStore((s) => s.activeSheet === 'quests');
  const close = useMapUiStore((s) => s.closeSheet);
  const openQuestDetail = useMapUiStore((s) => s.openQuestDetail);
  const completedQuests = useQuestStore((s) => s.completedQuests);
  const [hideDone, setHideDone] = useState(true);

  const isDone = (id: string) => completedQuests.includes(id);
  const list = hideDone ? quests.filter((q) => !isDone(q.id)) : quests;

  return (
    <BottomSheet open={open} title="Задания" onClose={close}>
      <button
        onClick={() => setHideDone((v) => !v)}
        className="mb-3 flex h-9 items-center gap-2 rounded-xs border border-lines-hover bg-card-menu px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary"
      >
        {hideDone ? <EyeOff className="size-4" strokeWidth={2} /> : <Eye className="size-4" strokeWidth={2} />}
        {hideDone ? 'Скрыты выполненные' : 'Показаны все'}
      </button>

      <ul className="flex flex-col gap-1 pb-2">
        {list.map((quest) => {
          const done = isDone(quest.id);
          return (
            <li key={quest.id} className="flex items-center gap-1">
              {/* Тап по строке — детали квеста drawer'ом поверх карты (M6) */}
              <button
                type="button"
                onClick={() => openQuestDetail(quest.id)}
                className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xs border border-lines-hover bg-card-menu px-3 text-left transition-colors hover:border-(--primary)/40"
              >
                <MapPin className="size-4 shrink-0 text-(--primary)" strokeWidth={2} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`truncate font-blender-book text-sm ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                    {quest.name}
                  </span>
                  <span className="font-blender-medium text-xs uppercase tracking-widest text-text-muted">{quest.trader}</span>
                </span>
              </button>
              {/* Стрелка — вторичное действие: открыть на карте заданий */}
              <Link
                href={`/eft/questmap?quest=${quest.id}`}
                aria-label="Открыть на карте заданий"
                className="flex size-11 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:text-(--primary)"
              >
                <ExternalLink className="size-4" strokeWidth={2} />
              </Link>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="py-6 text-center font-blender-book text-sm text-text-muted">
            {quests.length === 0 ? 'На этой локации нет заданий' : 'Все задания выполнены'}
          </li>
        )}
      </ul>
    </BottomSheet>
  );
}