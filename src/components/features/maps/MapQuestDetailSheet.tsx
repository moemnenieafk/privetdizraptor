'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { QuestDetail } from '@/components/features/quests/QuestDetail';
import { useMapUiStore } from '@/store/useMapUiStore';
import { traderCssVar } from '@/lib/trader-utils';
import type { MapViewerApi, MapQuestZone } from './map-frame-types';
import type { TaskRaw } from '@/types/quest';

interface Props {
  questTasks: TaskRaw[];
  questZones: MapQuestZone[];
  apiRef: React.RefObject<MapViewerApi | null>;
}

/**
 * M6 — детали квеста полноэкранным bottom-sheet'ом ПОВЕРХ карты (mobile-only, `lg:hidden`).
 * Переиспользует `QuestDetail variant="drawer"` (видео-гайд включён) — как десктопный
 * master-detail в MapSearchDrawer, но выезжает снизу. Тап по строке в MapQuestSheet ставит
 * `selectedQuestId` + sheet 'questDetail'; закрытие возвращает к списку заданий.
 *
 * Map-пины объектов ведут к ЗОНЕ квеста (в зеркале нет координат отдельных объектов —
 * TaskObjective без x/z; см. onLocate ниже): перелёт/подсветка + сворачивание шита.
 */
export function MapQuestDetailSheet({ questTasks, questZones, apiRef }: Props) {
  const open = useMapUiStore((s) => s.activeSheet === 'questDetail');
  const selectedQuestId = useMapUiStore((s) => s.selectedQuestId);
  const openSheet = useMapUiStore((s) => s.openSheet);
  const closeSheet = useMapUiStore((s) => s.closeSheet);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const taskById = useMemo(() => new Map(questTasks.map((t) => [t.id, t])), [questTasks]);
  const task = selectedQuestId ? (taskById.get(selectedQuestId) ?? null) : null;

  // Зона квеста для map-пинов (перелёт/подсветка). Гранулярность — на уровне квеста.
  const zone = useMemo(
    () => (selectedQuestId ? (questZones.find((z) => z.questId === selectedQuestId) ?? null) : null),
    [questZones, selectedQuestId],
  );

  // Закрытие по Escape + scroll-lock, пока открыт (как BottomSheet).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') openSheet('quests');
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, openSheet]);

  if (!mounted) return null;

  // Закрытие детали → назад к списку заданий (master-detail).
  const backToList = () => openSheet('quests');

  // Map-пин объекта: перелёт к зоне квеста + свернуть шит (карту видно). Нет зоны → пины не рисуем.
  const onLocate = zone
    ? () => {
        if (zone.outline.length >= 3) apiRef.current?.highlightZone(zone.outline);
        else if (zone.position) apiRef.current?.flyTo(zone.position, 4);
        closeSheet();
      }
    : undefined;

  const bg = task
    ? `radial-gradient(circle at 0% 0%, color-mix(in srgb, var(${traderCssVar(task.trader.normalizedName)}, transparent) 15%, transparent), rgba(0,0,0,0.92))`
    : undefined;

  return createPortal(
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-[60] lg:hidden ${open ? '' : 'pointer-events-none'}`}
    >
      {/* Затемнение — сплошное, чтобы карта и кнопки зума не просвечивали */}
      <button
        aria-label="Закрыть"
        onClick={backToList}
        className={`absolute inset-0 size-full bg-black/70 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Лист — почти на весь экран (у деталей своя шапка/футер); фон = трейдер-тинт как на десктопе. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={task?.name ?? 'Подробности задания'}
        className={`absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col rounded-t-2xl border-t border-lines-hover shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ background: bg }}
      >
        {open && task && <QuestDetail task={task} variant="drawer" onClose={backToList} onLocate={onLocate} />}
      </div>
    </div>,
    document.body,
  );
}
