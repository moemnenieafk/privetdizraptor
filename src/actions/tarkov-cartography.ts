"use server";

const ENDPOINT = "https://api.tarkov.dev/graphql";

async function gql<T>(query: string): Promise<T | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.errors?.length) return null;
    return json.data as T;
  } catch {
    return null;
  }
}

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

export async function fetchCartographyData(): Promise<CartographyData> {
  const data = await gql<{
    tasks: {
      id: string;
      name: string;
      kappaRequired: boolean;
      experience: number;
      trader: { name: string; normalizedName: string };
      map: { name: string; normalizedName: string } | null;
      objectives: { description: string; type: string; optional: boolean }[];
    }[];
    maps: { id: string; name: string; normalizedName: string; wiki: string | null }[];
  }>(`query {
    tasks(lang: ru) {
      id
      name
      kappaRequired
      experience
      trader { name normalizedName }
      map { name normalizedName }
      objectives { description type optional }
    }
    maps {
      id
      name
      normalizedName
      wiki
    }
  }`);

  if (!data) return { tasks: [], maps: [] };

  const tasks: CartographyTask[] = (data.tasks ?? [])
    .filter((t) => t.map != null && t.kappaRequired)
    .sort((a, b) => b.experience - a.experience)
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      name: t.name,
      kappaRequired: t.kappaRequired,
      experience: t.experience,
      traderName: t.trader.name,
      traderNormalizedName: t.trader.normalizedName,
      mapName: t.map!.name,
      mapNormalizedName: t.map!.normalizedName,
      primaryObjective:
        t.objectives.find((o) => !o.optional)?.description ?? null,
    }));

  const maps: CartographyMap[] = (data.maps ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    normalizedName: m.normalizedName,
    wiki: m.wiki ?? null,
  }));

  return { tasks, maps };
}
