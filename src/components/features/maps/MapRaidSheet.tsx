'use client';

import { Clock, Users, LogIn, LogOut, Footprints, Gauge } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useMapUiStore } from '@/store/useMapUiStore';
import type { MapView } from './map-types';

interface MapRaidSheetProps {
  data: MapView;
}

/**
 * Шит «Условия рейда» (mobile). Собирает параметры локации, вынесенные из нижнего бара:
 * длительность, игроки, уровень, стоимость входа/выхода, сводка спавнов.
 * Открывается иконкой рейда в верхней панели (openSheet('raid')).
 */
export function MapRaidSheet({ data }: MapRaidSheetProps) {
  const open = useMapUiStore((s) => s.activeSheet === 'raid');
  const close = useMapUiStore((s) => s.closeSheet);

  const level =
    data.minPlayerLevel != null
      ? `${data.minPlayerLevel}${data.maxPlayerLevel != null ? `–${data.maxPlayerLevel}` : '+'}`
      : null;

  const rows: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (data.raidDuration != null) rows.push({ icon: <Clock className="size-4" strokeWidth={2} />, label: 'Длительность', value: `${data.raidDuration} мин` });
  if (data.players) rows.push({ icon: <Users className="size-4" strokeWidth={2} />, label: 'Игроки', value: data.players });
  if (level) rows.push({ icon: <Gauge className="size-4" strokeWidth={2} />, label: 'Уровень', value: `ур. ${level}` });
  if (data.entryCost) rows.push({ icon: <LogIn className="size-4" strokeWidth={2} />, label: 'Вход', value: data.entryCost });
  if (data.exitCost) rows.push({ icon: <LogOut className="size-4" strokeWidth={2} />, label: 'Выход', value: data.exitCost });
  if (data.spawns) rows.push({ icon: <Footprints className="size-4" strokeWidth={2} />, label: 'Спавны', value: data.spawns });

  return (
    <BottomSheet open={open} title="Условия рейда" onClose={close}>
      {rows.length === 0 ? (
        <p className="py-6 text-center font-blender-book text-sm text-text-muted">Нет данных по этой локации</p>
      ) : (
        <ul className="flex flex-col gap-1 pb-2">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center gap-3 rounded-xs border border-lines-hover bg-card-menu px-3 py-2.5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center text-(--primary)">{r.icon}</span>
              <span className="flex-1 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">{r.label}</span>
              <span className="font-blender-medium text-sm text-text-primary">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}