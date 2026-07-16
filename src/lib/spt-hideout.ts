// Живой срез рецептов убежища из sp-tarkov/server (hideout/production.json).
// Тянем основные крафты (recipes): продукт, выход, время, уровень зоны, входы.
// Скав/культистские рецепты пока не трекаем. Импорт относительный (tsx-safe).

const SPT_URL =
  "https://raw.githubusercontent.com/sp-tarkov/server/master/project/assets/database/hideout/production.json";

export interface CraftInput {
  tpl: string;
  count: number;
}
export interface HideoutRecipe {
  recipeId: string;
  areaType: number;
  endProduct: string;
  count: number;
  productionTime: number;
  areaLevel: number | null;
  inputs: CraftInput[];
}

interface RawReq {
  type?: string;
  templateId?: string | null;
  count?: number | null;
  areaType?: number | null;
  requiredLevel?: number | null;
}
interface RawRecipe {
  _id?: string;
  areaType?: number;
  endProduct?: string;
  count?: number;
  productionTime?: number;
  requirements?: RawReq[];
}
interface RawProd {
  recipes?: RawRecipe[];
}

/** Список рецептов убежища. Никогда не бросает: при ошибке → []. */
export async function getHideoutRecipes(): Promise<HideoutRecipe[]> {
  try {
    const res = await fetch(SPT_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as RawProd;
    const out: HideoutRecipe[] = [];
    for (const r of json.recipes ?? []) {
      if (!r._id || !r.endProduct) continue;
      const reqs = r.requirements ?? [];
      const inputs: CraftInput[] = reqs
        .filter(
          (q): q is RawReq & { templateId: string } =>
            (q.type === "Item" || q.type === "Tool" || q.type === "Resource") &&
            typeof q.templateId === "string",
        )
        .map((q) => ({ tpl: q.templateId, count: Math.round(q.count ?? 1) }));
      const areaReq = reqs.find((q) => q.type === "Area");
      out.push({
        recipeId: r._id,
        areaType: r.areaType ?? -1,
        endProduct: r.endProduct,
        count: Math.round(r.count ?? 1),
        productionTime: Math.round(r.productionTime ?? 0),
        areaLevel: areaReq?.requiredLevel ?? null,
        inputs,
      });
    }
    return out;
  } catch {
    return [];
  }
}
