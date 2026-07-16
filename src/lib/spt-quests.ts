// Живой срез квестов из sp-tarkov/server (templates/quests.json) — награды, цели,
// требования. RU-имена квестов тянем из tarkov.dev (tasks lang: ru) по BSG-id.
// Импорт относительный (tsx-safe).

const SPT_URL =
  "https://raw.githubusercontent.com/sp-tarkov/server/master/project/assets/database/templates/quests.json";
const TARKOV_DEV = "https://api.tarkov.dev/graphql";

export interface QuestRewardItem {
  tpl: string;
  count: number;
}
export interface QuestStanding {
  traderId: string;
  value: number;
}
export interface QuestSnapshot {
  questId: string;
  name: string; // RU если есть, иначе EN QuestName
  traderId: string;
  xp: number;
  items: QuestRewardItem[];
  standing: QuestStanding[];
  objectives: number; // кол-во условий завершения
  objHash: string; // лёгкий хэш условий (сигнал «цели изменены»)
  prereqs: number; // кол-во условий старта
}

interface RawRewardItemNode {
  _tpl?: string;
  parentId?: string;
  upd?: { StackObjectsCount?: number };
}
interface RawReward {
  type?: string;
  value?: number | string;
  target?: string;
  items?: RawRewardItemNode[];
}
interface RawCondition {
  conditionType?: string;
  target?: unknown;
  value?: number | string;
  id?: string;
}
interface RawQuest {
  _id?: string;
  QuestName?: string;
  trader?: string;
  traderId?: string;
  rewards?: { Success?: RawReward[] };
  conditions?: { AvailableForFinish?: RawCondition[]; AvailableForStart?: RawCondition[] };
}

// Короткий детерминированный хэш строки (для отпечатка целей без хранения всего JSON).
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function fetchQuestNamesRu(): Promise<Map<string, string>> {
  try {
    const res = await fetch(TARKOV_DEV, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: `query { tasks(lang: ru) { id name } }` }),
      cache: "no-store",
    });
    if (!res.ok) return new Map();
    const json = (await res.json()) as { data?: { tasks?: Array<{ id: string; name: string }> } };
    return new Map((json.data?.tasks ?? []).map((t) => [t.id, t.name]));
  } catch {
    return new Map();
  }
}

/** Срезы квестов. Никогда не бросает: при ошибке источника → []. */
export async function getQuestSnapshots(): Promise<QuestSnapshot[]> {
  try {
    const [sptRes, namesRu] = await Promise.all([
      fetch(SPT_URL, { cache: "no-store" }),
      fetchQuestNamesRu(),
    ]);
    if (!sptRes.ok) return [];
    const quests = (await sptRes.json()) as Record<string, RawQuest>;

    const out: QuestSnapshot[] = [];
    for (const q of Object.values(quests)) {
      if (!q._id) continue;
      const success = q.rewards?.Success ?? [];

      let xp = 0;
      const items: QuestRewardItem[] = [];
      const standing: QuestStanding[] = [];
      for (const r of success) {
        if (r.type === "Experience") xp += Number(r.value ?? 0);
        else if (r.type === "TraderStanding" && r.target) standing.push({ traderId: r.target, value: Number(r.value ?? 0) });
        else if (r.type === "Item") {
          const root = r.items?.find((it) => !it.parentId) ?? r.items?.[0];
          if (root?._tpl) items.push({ tpl: root._tpl, count: Math.round(root.upd?.StackObjectsCount ?? Number(r.value ?? 1)) });
        }
      }

      const finish = q.conditions?.AvailableForFinish ?? [];
      const objSig = finish
        .map((c) => `${c.conditionType ?? ""}:${typeof c.target === "string" ? c.target : JSON.stringify(c.target ?? "")}:${c.value ?? ""}`)
        .sort()
        .join("|");

      out.push({
        questId: q._id,
        name: namesRu.get(q._id) ?? q.QuestName ?? q._id,
        traderId: q.trader ?? q.traderId ?? "",
        xp,
        items,
        standing,
        objectives: finish.length,
        objHash: hash(objSig),
        prereqs: (q.conditions?.AvailableForStart ?? []).length,
      });
    }
    return out;
  } catch {
    return [];
  }
}
