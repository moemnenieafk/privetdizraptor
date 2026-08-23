import type { Metadata } from 'next';
import { EFT_QUESTS } from '@/data/quests';
import { getEftPricesByIds } from '@/db/prices';
import { CollectorTracker, type CollectorItem } from '@/components/features/quests/CollectorTracker';
import type { TaskObjectiveItem } from '@/types/quest';

// Квест «Коллекционер» (Скупщик) — сдача предметов для разблокировки контейнера Kappa.
const COLLECTOR_ID = '5c51aac186f77432ea65c552';

export const metadata: Metadata = {
  title: 'Коллекционер',
  description:
    'Трекер контейнера Kappa в Escape from Tarkov: все предметы квеста «Коллекционер» в одном чек-листе — отмечайте найденные, ненайденные всплывают вверх.',
};

export default async function CollectorTrackerPage() {
  const quest = EFT_QUESTS.find((q) => q.normalizedName === 'collector' || q.id === COLLECTOR_ID);

  // Источник — item-objectives квеста из зеркала (§4.11). Ранее поверх лежал ручной оверрайд
  // (снятие Evasion-повязки + 4 стример-предмета патча) на устаревшее по этому квесту зеркало; крон
  // синканул корректные objectives (все 4 предмета и снятие повязки уже в них) → оверрайд убран,
  // читаем зеркало напрямую. Дубли еды (полное/съеденное) уходят вместе с оверрайдом.
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

  // Заголовок/навигацию/крошки даёт layout раздела (SectionLayoutNav). Здесь — только контент трекера.
  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <CollectorTracker questId={quest?.id ?? COLLECTOR_ID} items={items} />
      </div>
    </main>
  );
}
