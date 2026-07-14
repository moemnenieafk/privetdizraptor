import { EFT_QUESTS } from '@/data/quests';
import { EFT_EVENTS } from '@/data/eft-events';
import { getEftAchievements } from '@/db/landing';
import { getEftBarterIndex, type BarterSlim } from '@/db/event-barters';
import type {
  EftEvent,
  EftEventAchievementLink,
  EftEventBarterLink,
  EftEventBarterRef,
  EftEventContentIndex,
  EftEventContentStatus,
  EftEventQuestLink,
} from '@/types/eft-events';

/**
 * Мост «ивент ↔ база»: квесты, достижения, бартеры.
 * Только серверная сторона — тянет весь каталог квестов и живую БД, в клиентский бандл
 * не попадает: страница резолвит всё заранее и отдаёт в UI готовый индекс.
 *
 * Ключевая идея статусов: ивент временный, и его следы живут по-разному.
 *  - Квест есть в базе → он остался в игре (временные квесты tarkov.dev не отдаёт).
 *  - Достижение может остаться в списке, но перестать выдаваться → статус курируется вручную.
 *  - Бартер проверяется по живой БД: нашли у того же торговца на том же УЛ — актуален.
 */

const QUEST_BY_NORMALIZED_NAME = new Map(EFT_QUESTS.map((q) => [q.normalizedName, q]));

/** Дефолт статуса по категории, если у ивента не задан явный `contentStatus`. */
export function getEventContentStatus(event: EftEvent): EftEventContentStatus {
  if (event.contentStatus) return event.contentStatus;
  if (event.active) return 'permanent';
  switch (event.category) {
    case 'seasonal':
      return 'seasonal';
    case 'boss':
    case 'economy':
    case 'gameplay':
    case 'prewipe':
    case 'community':
      return 'expired';
    case 'lore':
    case 'collab':
      return 'unknown';
  }
}

export const EVENT_CONTENT_STATUS_LABEL: Record<EftEventContentStatus, string> = {
  permanent: 'Контент остался в игре',
  seasonal: 'Возвращается вместе с ивентом',
  expired: 'Награды больше не выдаются',
  unknown: 'Статус наград уточняется',
};

function norm(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').trim();
}

/** Бартер считается живым, если у того же торговца на том же УЛ сходятся награда и требование. */
function findBarter(index: BarterSlim[], ref: EftEventBarterRef): BarterSlim | null {
  const reward = ref.reward ? norm(ref.reward) : null;
  const required = ref.required ? norm(ref.required) : null;

  return (
    index.find((b) => {
      if (b.trader !== ref.trader || b.level !== ref.level) return false;
      if (reward && !b.rewardNames.some((n) => norm(n).includes(reward))) return false;
      if (required && !b.requiredNames.some((n) => norm(n).includes(required))) return false;
      return Boolean(reward || required);
    }) ?? null
  );
}

function resolveQuests(event: EftEvent): EftEventQuestLink[] {
  const links: EftEventQuestLink[] = [];
  for (const normalizedName of event.quests ?? []) {
    const quest = QUEST_BY_NORMALIZED_NAME.get(normalizedName);
    if (quest) links.push({ id: quest.id, name: quest.name, normalizedName });
  }
  return links;
}

/** eventId → квесты, достижения и бартеры ивента, сверенные с базой. */
export async function getEventContentIndex(): Promise<EftEventContentIndex> {
  const [achievements, barterIndex] = await Promise.all([
    getEftAchievements(),
    getEftBarterIndex(),
  ]);

  const achievementByName = new Map(achievements.map((a) => [norm(a.name), a]));
  const index: EftEventContentIndex = {};

  for (const event of EFT_EVENTS) {
    const quests = resolveQuests(event);

    const achievementLinks: EftEventAchievementLink[] = (event.achievements ?? []).map((ref) => {
      const found = achievementByName.get(norm(ref.name));
      return {
        ...ref,
        id: found?.id ?? null,
        playersCompletedPercent: found?.playersCompletedPercent ?? null,
      };
    });

    const barterLinks: EftEventBarterLink[] = (event.barters ?? []).map((ref) => {
      const found = findBarter(barterIndex, ref);
      return { ...ref, id: found?.id ?? null, live: found !== null };
    });

    if (quests.length || achievementLinks.length || barterLinks.length) {
      index[event.id] = { quests, achievements: achievementLinks, barters: barterLinks };
    }
  }

  return index;
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
