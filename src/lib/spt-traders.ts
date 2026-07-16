// Живой срез офферов торговцев из sp-tarkov/server (тот же источник, что loot-таблицы).
// Тянем root-ассорты (что торговец реально продаёт): предмет, цена/бартер, лояльность.
// Скупщик (fence) исключён — динамический ассорт, «изменения» = вечный шум.
//
// Импорт относительный — модуль может грузиться и под tsx-скриптом.
import { TRADERS } from "../data/traders";

const SPT_BASE =
  "https://raw.githubusercontent.com/sp-tarkov/server/master/project/assets/database/traders";

// slug → BSG-id торговца.
const TRADER_IDS: Record<string, string> = {
  prapor: "54cb50c76803fa8b248b4571",
  therapist: "54cb57776803fa99248b456e",
  skier: "58330581ace78e27b8b10cee",
  peacekeeper: "5935c25fb3acc3127c3d8cd9",
  mechanic: "5a7c2eca46aef81a7ca2145d",
  ragman: "5ac3b934156ae10c4430e83c",
  jaeger: "5c0647fdd443bc2504c2d371",
  ref: "6617beeaa9cfa777ca915b7c",
};

export interface CostReq {
  tpl: string;
  count: number;
}
export interface TraderOffer {
  loyalty: number | null;
  cost: CostReq[];
}
export interface TraderAssort {
  nameRu: string;
  offers: Map<string, TraderOffer>; // tpl → оффер
}

interface RawAssortItem {
  _id: string;
  _tpl: string;
  parentId?: string;
  slotId?: string;
}
interface RawAssort {
  items?: RawAssortItem[];
  barter_scheme?: Record<string, Array<Array<{ _tpl?: string; count?: number }>>>;
  loyal_level_items?: Record<string, number>;
}

const nameFor = (slug: string): string => TRADERS.find((t) => t.slug === slug)?.nameRu ?? slug;

async function fetchAssort(traderId: string): Promise<RawAssort | null> {
  try {
    const res = await fetch(`${SPT_BASE}/${traderId}/assort.json`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as RawAssort;
  } catch {
    return null;
  }
}

/**
 * Карта traderId → { имя, офферы }. Никогда не бросает: недоступный торговец пропускается.
 * Детектор сам решит не диффать по пустому срезу.
 */
export async function getTraderOffers(): Promise<Map<string, TraderAssort>> {
  const out = new Map<string, TraderAssort>();
  const entries = Object.entries(TRADER_IDS);
  const raws = await Promise.all(entries.map(([, id]) => fetchAssort(id)));

  entries.forEach(([slug, id], idx) => {
    const raw = raws[idx];
    if (!raw?.items) return;
    const offers = new Map<string, TraderOffer>();
    for (const it of raw.items) {
      if (it.parentId !== "hideout" || it.slotId !== "hideout") continue; // только корневые офферы
      if (offers.has(it._tpl)) continue; // один tpl — один оффер (первый)
      const barter = raw.barter_scheme?.[it._id]?.[0] ?? [];
      const cost: CostReq[] = barter
        .filter((r): r is { _tpl: string; count?: number } => typeof r._tpl === "string")
        .map((r) => ({ tpl: r._tpl, count: Math.round(r.count ?? 0) }));
      const loyalty = raw.loyal_level_items?.[it._id] ?? null;
      offers.set(it._tpl, { loyalty, cost });
    }
    if (offers.size > 0) out.set(id, { nameRu: nameFor(slug), offers });
  });

  return out;
}
