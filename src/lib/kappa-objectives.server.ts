import 'server-only';
import { EFT_QUESTS } from '@/data/quests';
import { COLLECTOR_QUEST_ID } from './quest-constants';
import { COLLECTOR_DROP_ITEM_IDS, COLLECTOR_EXTRA_ITEMS } from '@/data/eft-collector';
import type { TaskObjectiveItem } from '@/types/quest';

// Server-only: считает objective-id'ы предметов контейнера Kappa из EFT_QUESTS.
// Живёт отдельно от kappa-progress.ts (клиентский), чтобы тяжёлый EFT_QUESTS не попал в бандл
// Досье/инференса. RSC зовёт это и засевает id'ы в персист-стор — Каппа считается без рантайм-tasks.

/** objective-id'ы Каппы: item-цели квеста (валидный item, − снятые оверрайдом) + EXTRA-слаги. */
export function getKappaObjectiveIds(): string[] {
  const quest = EFT_QUESTS.find((q) => q.normalizedName === 'collector' || q.id === COLLECTOR_QUEST_ID);
  const base = (quest?.objectives ?? [])
    .filter(
      (o): o is TaskObjectiveItem & { item: NonNullable<TaskObjectiveItem['item']> } =>
        o.__typename === 'TaskObjectiveItem' && o.item != null && !COLLECTOR_DROP_ITEM_IDS.has(o.item.id),
    )
    .map((o) => o.id);
  return base.concat(COLLECTOR_EXTRA_ITEMS.map((e) => `extra:${e.slug}`));
}
