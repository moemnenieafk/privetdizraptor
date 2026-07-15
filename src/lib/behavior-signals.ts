import type { BehaviorDomain, BehaviorSignals } from '@/lib/role-inference';

// Поведенческие сигналы «Ульты»: во что игрок чаще тыкает на портале.
// Источник — pathname (без внешней аналитики). Счётчики затухают со временем.

/** Период полураспада веса визита (7 дней). Старые интересы теряют вес. */
export const BEHAVIOR_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

/** Ниже этого веса счётчик считаем нулевым и выкидываем (чистим хвосты). */
const EPSILON = 0.05;

/** Сопоставить путь домену поведения. null — путь роли не сигналит. */
export function pathToDomain(pathname: string): BehaviorDomain | null {
  const p = pathname.toLowerCase();
  // Порядок важен: специфичное — раньше общего.
  if (p.includes('/rookie')) return 'rookie';
  if (p.includes('gunsmith')) return 'gunsmith';
  if (p.includes('loadout')) return 'loadouts';
  if (p.includes('questmap') || p.includes('/quests/') && p.includes('map')) return 'questmap';
  if (p.includes('/quests')) return 'quests';
  if (p.includes('needed') || p.includes('tracker')) return 'needed';
  if (p.includes('barter')) return 'barters';
  if (p.includes('loot-container')) return 'loot';
  if (p.includes('loot-rate') || p.includes('price')) return 'prices';
  if (p.includes('bosses')) return 'bosses';
  if (p.includes('/maps')) return 'maps';
  if (p.includes('hideout')) return 'hideout';
  if (p.includes('/videos')) return 'videos';
  if (p.includes('gamesetting') || p.includes('/codex')) return 'codex';
  if (p.includes('/items')) return 'prices';
  return null;
}

/**
 * Применить экспоненциальное затухание к счётчикам за прошедшее время.
 * Возвращает новый объект; значения ниже EPSILON выкидываются.
 */
export function decayCounts(
  counts: BehaviorSignals,
  elapsedMs: number,
): BehaviorSignals {
  if (elapsedMs <= 0) return { ...counts };
  const factor = Math.pow(0.5, elapsedMs / BEHAVIOR_HALF_LIFE_MS);
  const out: BehaviorSignals = {};
  for (const [domain, value] of Object.entries(counts) as [BehaviorDomain, number][]) {
    const decayed = value * factor;
    if (decayed >= EPSILON) out[domain] = decayed;
  }
  return out;
}
