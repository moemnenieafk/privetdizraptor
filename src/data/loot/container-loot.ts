import raw from './container-loot.json';

export interface LootRow {
  /** BSG item tpl. */
  tpl: string;
  name: string;
  /** Шанс появления в контейнере, % (нормализовано из relativeProbability SPT). */
  prob: number;
}

export interface CountRow {
  count: number;
  prob: number;
}

export interface ContainerLoot {
  items: LootRow[];
  counts: CountRow[];
}

// Данные из SPT staticLoot (github.com/sp-tarkov/server), нормализованы скриптом
// scripts/build-container-loot.py. Ключ = slug из src/data/loot-containers.ts.
const DATA = raw as unknown as Record<string, ContainerLoot>;

export function getContainerLoot(slug: string): ContainerLoot | null {
  return DATA[slug] ?? null;
}
