'use client';

import { BottomSheet } from '@/components/layout/BottomSheet';
import { useQuestMapUiStore } from '@/store/useQuestMapUiStore';

export interface QuestTraderItem {
  normalizedName: string;
  name: string;
}

interface Props {
  traders: QuestTraderItem[];
  /** Перелёт к портрету торговца на карте (нода trader-{normalizedName}). */
  onFocusTrader: (normalizedName: string) => void;
}

/**
 * Шит выбора торговца (mobile). Фильтрации нет — тап делает перелёт к портрету
 * торговца на карте квестов (нода trader-{name}), шит закрывается.
 */
export function QuestTraderSheet({ traders, onFocusTrader }: Props) {
  const open = useQuestMapUiStore((s) => s.activeSheet === 'traders');
  const close = useQuestMapUiStore((s) => s.closeSheet);

  return (
    <BottomSheet open={open} title="Торговцы" onClose={close}>
      <ul className="grid grid-cols-2 gap-2 pb-2">
        {traders.map((t) => (
          <li key={t.normalizedName}>
            <button
              onClick={() => {
                onFocusTrader(t.normalizedName);
                close();
              }}
              className="flex h-14 w-full items-center gap-3 rounded-xs border border-lines-hover bg-card-menu px-2 transition-colors hover:border-(--primary)/40"
            >
              <img
                src={`/images/traders/eft/${t.normalizedName}.webp`}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-xs object-cover object-top"
              />
              <span className="min-w-0 flex-1 truncate text-left font-blender-medium text-sm uppercase tracking-widest text-text-primary">
                {t.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}