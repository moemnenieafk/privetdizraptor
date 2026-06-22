"use server";

import { EFT_QUESTS } from "@/data/quests";
import { getEftMaps } from "@/db/landing";

export type CartographyTask = {
  id: string;
  name: string;
  kappaRequired: boolean;
  experience: number;
  traderName: string;
  traderNormalizedName: string;
  mapName: string;
  mapNormalizedName: string;
  primaryObjective: string | null;
};

export type CartographyMap = {
  id: string;
  name: string;
  normalizedName: string;
  wiki: string | null;
};

export type CartographyData = {
  tasks: CartographyTask[];
  maps: CartographyMap[];
};

// Карты — из нашей БД (зеркало), задания — из статического EFT_QUESTS. Без tarkov.dev.
export async function fetchCartographyData(): Promise<CartographyData> {
  const maps = await getEftMaps();

  const tasks: CartographyTask[] = EFT_QUESTS
    .map((t) => {
      const mapObj = t.objectives.find((o) => o.maps && o.maps.length > 0);
      const map = mapObj?.maps?.[0] ?? null;
      return { t, map };
    })
    .filter((x): x is { t: (typeof EFT_QUESTS)[number]; map: NonNullable<typeof x.map> } => x.map != null && x.t.kappaRequired)
    .sort((a, b) => b.t.experience - a.t.experience)
    .slice(0, 8)
    .map(({ t, map }) => ({
      id: t.id,
      name: t.name,
      kappaRequired: t.kappaRequired,
      experience: t.experience,
      traderName: t.trader.name,
      traderNormalizedName: t.trader.normalizedName,
      mapName: map.name,
      mapNormalizedName: map.normalizedName,
      primaryObjective: t.objectives.find((o) => !o.optional)?.description ?? null,
    }));

  return { tasks, maps };
}
