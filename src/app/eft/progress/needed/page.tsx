import type { Metadata } from 'next';
import { EFT_QUESTS } from '@/data/quests';
import { itemIconUrl } from '@/lib/item-icon';
import { getHideoutNeeds, getHideoutStations } from '@/db/hideout';
import type { TaskObjectiveItem } from '@/types/quest';
import { type NeededReq } from './NeededItemsClient';
import { type HideoutNeedItem } from './HideoutNeededClient';
import { NeededTabs } from './NeededTabs';

export const metadata: Metadata = { title: 'Важные предметы | Прогресс ЦТА' };

// Слим-список предметных целей всех квестов (без DB — из статического EFT_QUESTS).
// Иконки — через itemIconUrl (наш Storage), не baked assets.tarkov.dev.
function buildQuestReqs(): NeededReq[] {
  const out: NeededReq[] = [];
  for (const t of EFT_QUESTS) {
    for (const o of t.objectives) {
      if (o.__typename === 'TaskObjectiveItem') {
        const oi = o as TaskObjectiveItem;
        if (!oi.item) continue; // дамп 1.1.0.0: уникальный квест-предмет без резолва в каталог → пропуск
        out.push({
          questId: t.id,
          questName: t.name,
          trader: t.trader.name,
          objectiveId: o.id,
          itemId: oi.item.id,
          itemName: oi.item.name,
          itemShort: oi.item.shortName,
          itemIcon: itemIconUrl(oi.item.id),
          needed: oi.count,
          foundInRaid: oi.foundInRaid,
        });
      }
    }
  }
  return out;
}

export default async function NeededItemsPage() {
  const questReqs = buildQuestReqs();
  // Убежище — из нашего зеркала hideout_upgrades (иконку добавляем тут, как в квестах).
  const [rawNeeds, hideoutStations] = await Promise.all([getHideoutNeeds(), getHideoutStations()]);
  const hideoutNeeds: HideoutNeedItem[] = rawNeeds.map((n) => ({ ...n, itemIcon: itemIconUrl(n.itemId) }));

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <NeededTabs questReqs={questReqs} hideoutNeeds={hideoutNeeds} hideoutStations={hideoutStations} />
      </div>
    </main>
  );
}
