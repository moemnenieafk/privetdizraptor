import { EFT_QUESTS } from '@/data/quests';
import { getQuestsNav } from '@/lib/quests-nav';
import { getEftPricesByIds, getEftPriceBySlug } from '@/db/prices';
import { itemIconUrl } from '@/lib/item-icon';
import { COLLECTOR_DROP_ITEM_IDS, COLLECTOR_EXTRA_ITEMS } from '@/data/eft-collector';
import { QuestsHubNav } from '@/components/features/quests/QuestsHubNav';
import { CollectorTracker, type CollectorItem } from '@/components/features/quests/CollectorTracker';
import type { TaskObjectiveItem } from '@/types/quest';

// Квест «Коллекционер» (Скупщик) — сдача предметов для разблокировки контейнера Kappa.
const COLLECTOR_ID = '5c51aac186f77432ea65c552';

export default async function CollectorTrackerPage() {
  const { sections } = getQuestsNav('/eft/quests/collector');
  const quest = EFT_QUESTS.find((q) => q.normalizedName === 'collector' || q.id === COLLECTOR_ID);

  // База — item-objectives квеста МИНУС снятые оверрайдом (Evasion-повязка, §4.11 — зеркало устарело).
  const objItems = (quest?.objectives ?? []).filter(
    (o): o is TaskObjectiveItem & { item: NonNullable<TaskObjectiveItem['item']> } =>
      o.__typename === 'TaskObjectiveItem' && o.item != null && !COLLECTOR_DROP_ITEM_IDS.has(o.item.id),
  );

  // Цвет редкости ячейки — из нашего зеркала цен (§4.11), НЕ из внешнего API. Джойн по id.
  const priceMap = await getEftPricesByIds(objItems.map((o) => o.item.id));
  const base: CollectorItem[] = objItems.map((o) => ({
    objectiveId: o.id,
    item: o.item,
    backgroundColor: priceMap.get(o.item.id)?.backgroundColor ?? undefined,
  }));

  // Курируемые стример-предметы патча (нет в objectives): резолвим inGameId+редкость по slug из зеркала.
  // Если предмет ещё не в зеркале — всё равно показываем (name/shortName из docs, плейсхолдер-иконка).
  const extras: CollectorItem[] = await Promise.all(
    COLLECTOR_EXTRA_ITEMS.map(async (e) => {
      const resolved = await getEftPriceBySlug(e.slug);
      const id = resolved?.id ?? e.slug;
      return {
        objectiveId: `extra:${e.slug}`,
        item: {
          id,
          name: e.name,
          shortName: e.shortName,
          image512pxLink: resolved?.id ? `https://assets.tarkov.dev/${resolved.id}-512.webp` : itemIconUrl(id),
        },
        backgroundColor: resolved?.price.backgroundColor ?? undefined,
      };
    }),
  );

  const items: CollectorItem[] = [...base, ...extras];

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
