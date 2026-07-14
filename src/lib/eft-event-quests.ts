import { EFT_QUESTS } from '@/data/quests';
import { EFT_EVENTS } from '@/data/eft-events';
import type { EftEvent, EftEventQuestLink } from '@/types/eft-events';

/**
 * Мост между реестром ивентов и базой квестов (tarkov.dev).
 * Только серверная сторона: тянет весь `eft-quests.json`, в клиентский бандл не попадает —
 * страница резолвит ссылки заранее и отдаёт в UI готовый Record.
 */

const QUEST_BY_NORMALIZED_NAME = new Map(EFT_QUESTS.map((q) => [q.normalizedName, q]));

/** eventId → задания ивента, реально существующие в базе. */
export function getEventQuestLinks(): Record<string, EftEventQuestLink[]> {
  const result: Record<string, EftEventQuestLink[]> = {};

  for (const event of EFT_EVENTS) {
    if (!event.quests?.length) continue;
    const links: EftEventQuestLink[] = [];
    for (const normalizedName of event.quests) {
      const quest = QUEST_BY_NORMALIZED_NAME.get(normalizedName);
      if (quest) links.push({ id: quest.id, name: quest.name, normalizedName });
    }
    if (links.length > 0) result[event.id] = links;
  }

  return result;
}

/** Обратный индекс: normalizedName квеста → ивент, с которым он пришёл. */
const EVENT_BY_QUEST: Map<string, EftEvent> = (() => {
  const map = new Map<string, EftEvent>();
  for (const event of EFT_EVENTS) {
    for (const normalizedName of event.quests ?? []) map.set(normalizedName, event);
  }
  return map;
})();

export function getQuestEvent(normalizedName: string): EftEvent | null {
  return EVENT_BY_QUEST.get(normalizedName) ?? null;
}
