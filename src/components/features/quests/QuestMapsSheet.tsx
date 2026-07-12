'use client';

import { Check } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useQuestMapUiStore } from '@/store/useQuestMapUiStore';

export interface QuestMapItem {
  id: string;
  name: string;
  iconClass: string | null | undefined;
}

interface Props {
  maps: QuestMapItem[];
  selectedMaps: Set<string>;
  onToggleMap: (id: string) => void;
  onReset: () => void;
}

/**
 * Шит фильтра по картам (mobile). Мульти-выбор: тап переключает карту в фильтре,
 * шит остаётся открытым (можно отметить несколько).
 */
export function QuestMapsSheet({ maps, selectedMaps, onToggleMap, onReset }: Props) {
  const open = useQuestMapUiStore((s) => s.activeSheet === 'maps');
  const close = useQuestMapUiStore((s) => s.closeSheet);

  return (
    <BottomSheet open={open} title="Карты" onClose={close}>
      {selectedMaps.size > 0 && (
        <button
          onClick={onReset}
          className="mb-3 flex h-9 items-center gap-2 rounded-xs border border-lines-hover bg-card-menu px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:text-(--primary)"
        >
          Сбросить фильтр ({selectedMaps.size})
        </button>
      )}

      <ul className="flex flex-col gap-1 pb-2">
        {maps.map((m) => {
          const active = selectedMaps.has(m.id);
          return (
            <li key={m.id}>
              <button
                onClick={() => onToggleMap(m.id)}
                className={`flex h-12 w-full items-center gap-3 rounded-xs border bg-card-menu px-3 transition-colors ${
                  active ? 'border-(--primary)' : 'border-lines-hover'
                }`}
              >
                <span className={`flex size-7 shrink-0 items-center justify-center ${active ? 'text-(--primary)' : 'text-text-secondary'}`}>
                  {m.iconClass ? (
                    <span className={`icon-mask ${m.iconClass} h-6 w-6`} />
                  ) : (
                    <span className="font-blender-medium text-xs uppercase leading-none">{m.name.slice(0, 3)}</span>
                  )}
                </span>
                <span className={`flex-1 text-left font-blender-medium text-sm uppercase tracking-widest ${active ? 'text-(--primary)' : 'text-text-primary'}`}>
                  {m.name}
                </span>
                {active && <Check className="size-5 shrink-0 text-(--primary)" strokeWidth={2} />}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}