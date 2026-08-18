import { EFT_QUESTS } from '@/data/quests';
import { getQuestsNav } from '@/lib/quests-nav';
import { getEftPricesByIds } from '@/db/prices';
import { QuestsHubNav } from '@/components/features/quests/QuestsHubNav';
import { CollectorTracker, type CollectorItem } from '@/components/features/quests/CollectorTracker';
import type { TaskObjectiveItem } from '@/types/quest';

// Квест «Коллекционер» (Скупщик) — сдача предметов для разблокировки контейнера Kappa.
const COLLECTOR_ID = '5c51aac186f77432ea65c552';

export default async function CollectorTrackerPage() {
  const { sections } = getQuestsNav('/eft/quests/collector');
  const quest = EFT_QUESTS.find((q) => q.normalizedName === 'collector' || q.id === COLLECTOR_ID);

  const objItems = (quest?.objectives ?? []).filter(
    (o): o is TaskObjectiveItem & { item: NonNullable<TaskObjectiveItem['item']> } =>
      o.__typename === 'TaskObjectiveItem' && o.item != null,
  );

  // Цвет редкости ячейки — из нашего зеркала цен (§4.11), НЕ из внешнего API. Джойн по id.
  const priceMap = await getEftPricesByIds(objItems.map((o) => o.item.id));
  const items: CollectorItem[] = objItems.map((o) => ({
    objectiveId: o.id,
    item: o.item,
    backgroundColor: priceMap.get(o.item.id)?.backgroundColor ?? undefined,
  }));

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <QuestsHubNav
          iconUrl="/icons/eft/profile-pannel/kappa_icon.svg"
          title="Коллекционер"
          description="Все предметы для контейнера Kappa. Отмечай найденные — они уходят вниз, а ненайденные всплывают вверх."
          tabs={sections}
          activeHref="/eft/quests/collector"
          count={items.length}
        />
        <CollectorTracker questId={quest?.id ?? COLLECTOR_ID} items={items} />
      </div>
    </main>
  );
}
