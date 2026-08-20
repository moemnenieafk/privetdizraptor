// Консолидированный ридер объединённого трекера «Важные предметы» (RSC-only).
// Собирает индекс «предмет → кому нужен» из статических квестов (по режиму профиля) +
// зеркала убежища. Категории целей (решение important-items-merge):
//   • single-item (giveItem/findItem/plantItem/sellItem с .item) → per-item агрегат;
//   • any-of (o.anyOf + acceptedItems[]) → отдельная «групповая строка» «N из категории»;
//   • квест-предметы (findQuestItem/…) → per-item, флаг isQuestItem (только рейд, нельзя купить).
// FiR — per-source (и квесты, и убежище). Имена/иконки — наш Storage (itemIconUrl), не baked.
import { and, eq, inArray } from 'drizzle-orm';
import { getQuests, type QuestMode } from '@/data/quests';
import { getHideoutNeeds, CURRENCY_IDS } from '@/db/hideout';
import { db } from '@/db';
import { prices } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { itemIconUrl } from '@/lib/item-icon';
import type { TaskObjectiveItem } from '@/types/quest';

export type NeededMode = QuestMode;

export interface NeededQuestSource {
  questId: string;
  questName: string;
  trader: string;
  /** normalizedName торговца — для цвета/аватара квест-чипа (TRADER_COLORS/traderImg). */
  traderNn: string;
  /** minPlayerLevel квеста — для бейджа «УР. N+». */
  minLevel: number;
  objectiveId: string;
  count: number;
  fir: boolean;
  /** giveItem | findItem | plantItem | sellItem | findQuestItem | … */
  type: string;
  /** RU-имена карт «где искать» (из objective.maps). */
  maps?: string[];
}
export interface NeededHideoutSource {
  station: string;
  stationName: string;
  level: number;
  count: number;
  fir: boolean;
}
export interface NeededItem {
  itemId: string;
  itemName: string;
  itemShort: string;
  itemIcon: string;
  /** normalizedName из prices — кросс-линк на карточку предмета. */
  slug?: string;
  /** Имя цвета слота (violet/blue/…) из prices — для фона ячейки (getTarkovBackgroundColor). */
  backgroundColor?: string;
  quests: NeededQuestSource[];
  hideout: NeededHideoutSource[];
  /** Предмет — квест-предмет (только рейд, нельзя купить/застэшить). */
  isQuestItem: boolean;
  /** Сумма нужного по всем источникам. */
  neededTotal: number;
  /** Из neededTotal — сколько должно быть FiR. */
  neededFir: number;
}
export interface NeededGroupVariant {
  id: string;
  name: string;
  shortName: string;
  icon: string;
}
export interface NeededGroup {
  /** objectiveId — стабильный ключ строки-группы. */
  key: string;
  questId: string;
  questName: string;
  trader: string;
  count: number;
  fir: boolean;
  /** Принимаемые варианты (любой из них засчитывается). */
  accepted: NeededGroupVariant[];
}
export interface NeededData {
  items: NeededItem[];
  groups: NeededGroup[];
}

const REAL = new Set(['giveItem', 'findItem', 'plantItem', 'sellItem']);
const QITEM = new Set(['findQuestItem', 'giveQuestItem', 'plantQuestItem']);
// «Отдающие» цели расходуют предметы (аддитивно между собой); «находящие» — те же предметы (max).
const CONSUME = new Set(['giveItem', 'giveQuestItem', 'plantItem', 'plantQuestItem', 'sellItem']);
const FIND = new Set(['findItem', 'findQuestItem']);

/** Собрать индекс нужных предметов для режима (regular/pve). RSC-only (читает зеркало убежища). */
export async function buildNeededItems(mode: NeededMode = 'regular'): Promise<NeededData> {
  const quests = getQuests(mode);
  const items = new Map<string, NeededItem>();
  const groups: NeededGroup[] = [];

  const ensure = (id: string, name: string, short: string): NeededItem => {
    let ni = items.get(id);
    if (!ni) {
      ni = {
        itemId: id,
        itemName: name,
        itemShort: short,
        itemIcon: itemIconUrl(id),
        quests: [],
        hideout: [],
        isQuestItem: false,
        neededTotal: 0,
        neededFir: 0,
      };
      items.set(id, ni);
    }
    return ni;
  };

  // Один квест часто просит один предмет в НЕСКОЛЬКИХ целях: найти + сдать (find→give — это
  // ОДНИ И ТЕ ЖЕ предметы, count=max) или заложить в разных местах (plant×N — аддитивно, count=sum).
  // Схлопываем цели квеста по предмету в ОДИН источник, иначе визуальный дубль + двойной счёт в тоталах.
  type QObj = { id: string; type: string; count: number; fir: boolean; maps?: string[] };
  for (const t of quests) {
    const perItem = new Map<string, { name: string; short: string; isQItem: boolean; objs: QObj[] }>();

    for (const o of t.objectives) {
      if (o.__typename !== 'TaskObjectiveItem') continue;
      const oi = o as TaskObjectiveItem;
      const isQItem = QITEM.has(oi.type);
      if (!isQItem && !REAL.has(oi.type)) continue;

      // any-of → отдельная групповая строка (не мержим в per-item)
      if (oi.anyOf && Array.isArray(oi.acceptedItems) && oi.acceptedItems.length > 1) {
        groups.push({
          key: oi.id,
          questId: t.id,
          questName: t.name,
          trader: t.trader.name,
          count: oi.count ?? 1,
          fir: !!oi.foundInRaid,
          accepted: oi.acceptedItems.map((a) => ({
            id: a.id,
            name: a.name,
            shortName: a.shortName,
            icon: itemIconUrl(a.id),
          })),
        });
        continue;
      }

      if (!oi.item) continue; // нерезолвнутый предмет → пропуск (§4.4)
      if (CURRENCY_IDS.has(oi.item.id)) continue; // валюта (₽/€/$) — не собираемый предмет
      let e = perItem.get(oi.item.id);
      if (!e) {
        e = { name: oi.item.name, short: oi.item.shortName, isQItem: false, objs: [] };
        perItem.set(oi.item.id, e);
      }
      e.isQItem = e.isQItem || isQItem;
      e.objs.push({
        id: oi.id,
        type: oi.type,
        count: oi.count ?? 1,
        fir: !!oi.foundInRaid,
        maps: oi.maps?.map((m) => m.name).filter((n): n is string => !!n),
      });
    }

    for (const [itemId, e] of perItem) {
      const ni = ensure(itemId, e.name, e.short);
      // count: сумма «отдающих» (give/plant/sell — расходуются) vs max «находящих» (find — те же предметы).
      const consumeSum = e.objs.filter((o) => CONSUME.has(o.type)).reduce((s, o) => s + o.count, 0);
      const findMax = e.objs.filter((o) => FIND.has(o.type)).reduce((m, o) => Math.max(m, o.count), 0);
      const count = Math.max(consumeSum, findMax) || e.objs.reduce((m, o) => Math.max(m, o.count), 1);
      // представитель для записи прогресса: приоритет «отдающим», затем макс count.
      const rep = [...e.objs].sort(
        (a, b) => (CONSUME.has(b.type) ? 1 : 0) - (CONSUME.has(a.type) ? 1 : 0) || b.count - a.count,
      )[0];
      ni.quests.push({
        questId: t.id,
        questName: t.name,
        trader: t.trader.name,
        traderNn: t.trader.normalizedName,
        minLevel: t.minPlayerLevel ?? 0,
        objectiveId: rep.id,
        count,
        fir: e.objs.some((o) => o.fir),
        type: rep.type,
        maps: [...new Set(e.objs.flatMap((o) => o.maps ?? []))],
      });
      if (e.isQItem) ni.isQuestItem = true;
    }
  }

  // Убежище — из зеркала (уже агрегировано по предмету, FiR в sources).
  const hideout = await getHideoutNeeds();
  for (const h of hideout) {
    const ni = ensure(h.itemId, h.itemName, h.itemShort);
    if (!ni.itemName) ni.itemName = h.itemName;
    if (!ni.itemShort) ni.itemShort = h.itemShort;
    for (const s of h.sources) {
      ni.hideout.push({
        station: s.station,
        stationName: s.stationName,
        level: s.level,
        count: s.count,
        fir: !!s.fir,
      });
    }
  }

  for (const ni of items.values()) {
    let total = 0;
    let fir = 0;
    for (const q of ni.quests) {
      total += q.count;
      if (q.fir) fir += q.count;
    }
    for (const h of ni.hideout) {
      total += h.count;
      if (h.fir) fir += h.count;
    }
    ni.neededTotal = total;
    ni.neededFir = fir;
  }

  // slug + backgroundColor (цвет слота) из зеркала prices — кросс-линк + фон ячейки.
  const ids = [...items.keys()];
  if (ids.length) {
    const gameId = await eftGameId();
    const rows = await db
      .select({
        inGameId: prices.inGameId,
        normalizedName: prices.normalizedName,
        backgroundColor: prices.backgroundColor,
      })
      .from(prices)
      .where(and(eq(prices.gameId, gameId), inArray(prices.inGameId, ids)));
    const byId = new Map(rows.map((r) => [r.inGameId, r]));
    for (const ni of items.values()) {
      const p = byId.get(ni.itemId);
      if (p?.normalizedName) ni.slug = p.normalizedName;
      if (p?.backgroundColor) ni.backgroundColor = p.backgroundColor;
    }
  }

  const list = [...items.values()].sort(
    (a, b) => b.neededTotal - a.neededTotal || a.itemName.localeCompare(b.itemName),
  );
  return { items: list, groups };
}
