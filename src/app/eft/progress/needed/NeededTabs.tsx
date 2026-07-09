'use client';

import { useMemo, useState } from 'react';
import { NeededItemsClient, type NeededReq } from './NeededItemsClient';
import { HideoutNeededClient, type HideoutNeedItem } from './HideoutNeededClient';
import { type HideoutStationInfo } from '@/components/features/hideout/HideoutLevelsPanel';
import { useQuestStore } from '@/store/useQuestStore';
import { useHideoutStore } from '@/store/useHideoutStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { computeStashOverlay, type StashOverlay } from '@/lib/stash-overlay';

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

  const completedQuests = useQuestStore((s) => s.completedQuests);
  const itemProgress = useQuestStore((s) => s.itemProgress);
  const levels = useHideoutStore((s) => s.levels);
  const ownedItems = useInventoryStore((s) => s.ownedItems);

  // Общий пул: стэш тратится один раз (убежище → не-FiR квесты). Ключ — itemId.
  const overlay = useMemo(() => {
    const soft = new Map<string, number>();
    const fir = new Map<string, number>();
    const hideout = new Map<string, number>();
    const ids = new Set<string>();

    const completed = new Set(completedQuests);
    for (const r of questReqs) {
      if (completed.has(r.questId)) continue;
      const found = Math.min(r.needed, itemProgress[r.questId]?.[r.objectiveId] ?? 0);
      const rem = Math.max(0, r.needed - found);
      ids.add(r.itemId);
      if (rem === 0) continue;
      const bucket = r.foundInRaid ? fir : soft;
      bucket.set(r.itemId, (bucket.get(r.itemId) ?? 0) + rem);
    }
    for (const n of hideoutNeeds) {
      const need = n.sources.reduce((a, src) => a + (src.level > (levels[src.station] ?? 0) ? src.count : 0), 0);
      ids.add(n.itemId);
      if (need > 0) hideout.set(n.itemId, need);
    }

    const map = new Map<string, StashOverlay>();
    for (const id of ids) {
      map.set(
        id,
        computeStashOverlay({
          stash: ownedItems[id] ?? 0,
          hideoutNeed: hideout.get(id) ?? 0,
          questSoftNeed: soft.get(id) ?? 0,
          questFirNeed: fir.get(id) ?? 0,
        }),
      );
    }
    return map;
  }, [questReqs, hideoutNeeds, completedQuests, itemProgress, levels, ownedItems]);

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

      {tab === 'quests' ? (
        <NeededItemsClient reqs={questReqs} overlay={overlay} />
      ) : (
        <HideoutNeededClient needs={hideoutNeeds} stations={hideoutStations} overlay={overlay} />
      )}
    </div>
  );
}
