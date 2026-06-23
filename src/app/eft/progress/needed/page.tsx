import type { Metadata } from 'next';
import { EFT_QUESTS } from '@/data/quests';
import { itemIconUrl } from '@/lib/item-icon';
import type { TaskObjectiveItem } from '@/types/quest';
import { NeededItemsClient, type NeededReq } from './NeededItemsClient';

export const metadata: Metadata = { title: 'Нужные предметы | Прогресс ЦТА' };

// Слим-список предметных целей всех квестов (без DB — из статического EFT_QUESTS).
// Иконки — через itemIconUrl (наш Storage), не baked assets.tarkov.dev.
function buildReqs(): NeededReq[] {
  const out: NeededReq[] = [];
  for (const t of EFT_QUESTS) {
    for (const o of t.objectives) {
      if (o.__typename === 'TaskObjectiveItem') {
        const oi = o as TaskObjectiveItem;
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

export default function NeededItemsPage() {
  const reqs = buildReqs();
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">Нужные предметы</h1>
          <p className="mt-2 text-sm text-text-secondary font-blender-book">
            Что осталось собрать по активным квестам — агрегировано по предметам. Отмечайте прогресс кнопками ± (он
            общий с картой квестов). Часть для убежища появится позже.
          </p>
        </header>
        <NeededItemsClient reqs={reqs} />
      </div>
    </main>
  );
}
