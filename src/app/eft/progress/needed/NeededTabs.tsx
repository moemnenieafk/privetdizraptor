'use client';

import { useState } from 'react';
import { NeededItemsClient, type NeededReq } from './NeededItemsClient';
import { HideoutNeededClient, type HideoutNeedItem } from './HideoutNeededClient';
import { type HideoutStationInfo } from '@/components/features/hideout/HideoutLevelsPanel';

type Tab = 'quests' | 'hideout';

export function NeededTabs({
  questReqs,
  hideoutNeeds,
  hideoutStations,
}: {
  questReqs: NeededReq[];
  hideoutNeeds: HideoutNeedItem[];
  hideoutStations: HideoutStationInfo[];
}) {
  const [tab, setTab] = useState<Tab>('quests');

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'quests', label: 'Квесты', count: new Set(questReqs.map((r) => r.itemId)).size },
    { id: 'hideout', label: 'Убежище', count: hideoutNeeds.length },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex h-10 items-center gap-2 rounded px-4 font-blender-medium text-type-label uppercase tracking-widest transition-colors ${
              tab === t.id
                ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-(--primary)'
                : 'border border-lines-hover bg-card-menu text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
            <span className={`text-type-caption tabular-nums ${tab === t.id ? 'text-(--primary)' : 'text-text-muted'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'quests' ? <NeededItemsClient reqs={questReqs} /> : <HideoutNeededClient needs={hideoutNeeds} stations={hideoutStations} />}
    </div>
  );
}
