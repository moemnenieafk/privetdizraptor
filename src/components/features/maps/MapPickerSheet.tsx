'use client';

import { Check } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useMapUiStore } from '@/store/useMapUiStore';

export interface MapPickerItem {
  id: string;
  name: string;
  iconClass: string | null | undefined;
  questCount?: number;
}

interface MapPickerSheetProps {
  maps: MapPickerItem[];
  activeMapId: string;
  onSelect: (id: string) => void;
}

export function MapPickerSheet({ maps, activeMapId, onSelect }: MapPickerSheetProps) {
  const open = useMapUiStore((s) => s.activeSheet === 'maps');
  const close = useMapUiStore((s) => s.closeSheet);

  return (
    <BottomSheet open={open} title="Карты" onClose={close}>
      <ul className="flex flex-col gap-1 pb-2">
        {maps.map((m) => {
          const active = m.id === activeMapId;
          return (
            <li key={m.id}>
              <button
                onClick={() => {
                  onSelect(m.id);
                  close();
                }}
                className={`flex h-14 w-full items-center gap-3 rounded-xs border px-3 ${active ? 'border-(--primary) bg-card-menu' : 'border-lines-hover bg-card-menu'}`}
              >
                <span className={`flex size-8 shrink-0 items-center justify-center ${active ? 'text-(--primary)' : 'text-text-secondary'}`}>
                  {m.iconClass ? (
                    <span className={`icon-mask ${m.iconClass} h-7 w-7`} />
                  ) : (
                    <span className="font-blender-medium text-sm uppercase leading-none">{m.name.slice(0, 3)}</span>
                  )}
                </span>
                <span className={`flex-1 text-left font-blender-medium text-sm uppercase tracking-widest ${active ? 'text-(--primary)' : 'text-text-primary'}`}>
                  {m.name}
                </span>
                {typeof m.questCount === 'number' && m.questCount > 0 && (
                  <span className="font-blender-medium text-xs text-text-secondary">{m.questCount} зад.</span>
                )}
                {active && <Check className="size-5 text-(--primary)" strokeWidth={2} />}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}