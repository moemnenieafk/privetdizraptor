"use server";

const ENDPOINT = "https://api.tarkov.dev/graphql";

async function gql<T>(query: string): Promise<T | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.errors?.length) return null;
    return json.data as T;
  } catch {
    return null;
  }
}

export type FleaItem = {
  name: string;
  avg24hPrice: number;
  changeLast48hPercent: number;
};

export type TarkovContextData = {
  serverOnline: boolean;
  serverLabel: string;
  fleaItems: FleaItem[];
  nearestTrader: { name: string; resetTime: string } | null;
};

export async function fetchTarkovContext(): Promise<TarkovContextData> {
  const [statusData, itemsData, tradersData] = await Promise.all([
    gql<{
      status: { currentStatuses: { name: string; status: number }[] };
    }>(`query {
      status {
        currentStatuses { name status }
      }
    }`),

    gql<{ items: { name: string; avg24hPrice: number | null; changeLast48hPercent: number | null }[] }>(
      `query {
        items(limit: 12, lang: ru) {
          name
          avg24hPrice
          changeLast48hPercent
        }
      }`
    ),

    gql<{ traders: { name: string; normalizedName: string; resetTime: string | null }[] }>(
      `query {
        traders {
          name
          normalizedName
          resetTime
        }
      }`
    ),
  ]);

  // Server status (status 0 = online)
  const statuses = statusData?.status?.currentStatuses ?? [];
  const mainStatus = statuses.find((s) => s.name === "Trading") ?? statuses[0];
  const serverOnline = mainStatus ? mainStatus.status === 0 : true;

  // Flea ticker — top items by absolute 48h change
  const fleaItems: FleaItem[] = (itemsData?.items ?? [])
    .filter(
      (i): i is FleaItem =>
        i.avg24hPrice != null &&
        i.changeLast48hPercent != null &&
        i.avg24hPrice > 0
    )
    .sort((a, b) => Math.abs(b.changeLast48hPercent) - Math.abs(a.changeLast48hPercent))
    .slice(0, 6);

  // Nearest trader reset
  const now = Date.now();
  const tradersWithReset = (tradersData?.traders ?? []).filter(
    (t): t is { name: string; normalizedName: string; resetTime: string } =>
      t.resetTime != null
  );
  let nearestTrader: TarkovContextData["nearestTrader"] = null;

  if (tradersWithReset.length > 0) {
    const nearest = tradersWithReset.reduce((best, t) => {
      const ms = new Date(t.resetTime).getTime();
      const diff = ((ms - now) % 86_400_000 + 86_400_000) % 86_400_000;
      const bestMs = new Date(best.resetTime).getTime();
      const bestDiff = ((bestMs - now) % 86_400_000 + 86_400_000) % 86_400_000;
      return diff < bestDiff ? t : best;
    });
    nearestTrader = { name: nearest.name, resetTime: nearest.resetTime };
  }

  return {
    serverOnline,
    serverLabel: mainStatus?.name ?? "EFT SERVER",
    fleaItems,
    nearestTrader,
  };
}
