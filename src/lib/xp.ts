import type { PlayerRole } from '@/lib/role-inference';
import { ARCHETYPE_FEATURES, FEATURE_CATALOG, FEATURE_BY_ID, type PortalFeature } from '@/data/feature-catalog';

// Чистая математика клиентского XP-слоя (docs/decisions/points-economy.md).
// §4.7: вся арифметика прокачки живёт здесь — стор только хранит и диспатчит.
// Числа ЧЕРНОВЫЕ (анкеры из computeStanding-весов) → тюнит V4DYA, потому все вынесены в константы.

/** XP за визит-использование фичи (мелкий, затухающий смысл — ферма бессмысленна). */
export const XP_VISIT = 1;
/** Жирный бонус за первое использование фичи (discovery, раз на фичу). */
export const XP_DISCOVERY = 15;
/** XP завершённых флоу по id (черновик из таблицы спеки). */
export const XP_FLOW: Record<string, number> = {
  'profile-load': 30, // загрузил profile.json
  loadout: 20, // собрал лоадаут / решил Gunsmith
  tracker: 10, // добавил квест/предмет в трекер
  'tutorial-step': 12, // прошёл этап «Пути Новобранца»
};

/**
 * Какой фиче каталога принадлежит флоу — для проверки on-архетип (×2 в под-трек).
 * profile-load/tutorial-step не привязаны к доменной фиче → всегда базовый XP (ширина), под-трек не растят.
 */
export const FLOW_FEATURE: Record<string, string> = {
  loadout: 'loadouts',
  tracker: 'tracker',
};
/** Множитель ×2 в под-трек активного архетипа, когда фича ∈ его набора (off-архетип = ×1). */
export const ARCHETYPE_MULTIPLIER = 2;
/** Пороги под-трека архетипа I→V (черновик; L1 0 · L2 50 · L3 150 · L4 350 · L5 700). */
export const SUBTRACK_THRESHOLDS = [0, 50, 150, 350, 700] as const;
/** Сколько подсказок «Крутые фичи для тебя» отдаём максимум. */
export const SUGGEST_LIMIT = 3;

/** Уровень под-трека (1..N по SUBTRACK_THRESHOLDS) + прогресс 0..1 внутри уровня. */
export interface SubTrackLevel {
  /** Текущий уровень 1..SUBTRACK_THRESHOLDS.length. */
  level: number;
  /** Прогресс 0..1 внутри текущего уровня (1 на максимуме). */
  progress: number;
  /** Порог следующего уровня, либо null если достигнут максимум. */
  nextAt: number | null;
}

/** Уровень под-трека по накопленному XP архетипа. */
export function subTrackLevel(xp: number): SubTrackLevel {
  const safe = xp > 0 ? xp : 0;
  const max = SUBTRACK_THRESHOLDS.length;

  // Индекс последнего пройденного порога = уровень (1-based).
  let idx = 0;
  for (let i = 0; i < max; i += 1) {
    if (safe >= SUBTRACK_THRESHOLDS[i]) idx = i;
    else break;
  }
  const level = idx + 1;

  // Максимальный уровень — прогресс всегда полный, следующего порога нет.
  if (level >= max) {
    return { level: max, progress: 1, nextAt: null };
  }

  const floor = SUBTRACK_THRESHOLDS[idx];
  const nextAt = SUBTRACK_THRESHOLDS[idx + 1];
  const span = nextAt - floor;
  const progress = span > 0 ? (safe - floor) / span : 1;
  return { level, progress: progress < 0 ? 0 : progress > 1 ? 1 : progress, nextAt };
}

/** Входит ли фича в набор архетипа (даёт ли ×2 в под-трек этого архетипа). */
export function isOnArchetype(featureId: string, role: PlayerRole): boolean {
  return ARCHETYPE_FEATURES[role].includes(featureId);
}

/**
 * Подсказки фич: НЕтронутые фичи (пробелы открытия) с приоритетом релевантности архетипу.
 * Порядок: сперва фичи набора архетипа (в порядке набора), затем прочие (в порядке каталога).
 * Исключаются: уже открытые (discovered), уже показанные на главной (onGrid — чтобы подсказки
 * не дублировали избранные плитки), action-фичи (feedback) и не построенные (ready:false).
 * Топ-SUGGEST_LIMIT.
 */
export function suggestFeatures(
  role: PlayerRole,
  discovered: Set<string>,
  onGrid: Set<string> = new Set(),
): PortalFeature[] {
  const eligible = (f: PortalFeature | undefined): f is PortalFeature =>
    f !== undefined && f.action === undefined && f.ready && !discovered.has(f.id) && !onGrid.has(f.id);

  const seen = new Set<string>();
  const out: PortalFeature[] = [];

  // 1. Релевантные архетипу (приоритет), в порядке набора.
  for (const id of ARCHETYPE_FEATURES[role]) {
    const f = FEATURE_BY_ID[id];
    if (eligible(f) && !seen.has(f.id)) {
      seen.add(f.id);
      out.push(f);
    }
  }
  // 2. Прочие нетронутые, в порядке каталога.
  for (const f of FEATURE_CATALOG) {
    if (eligible(f) && !seen.has(f.id)) {
      seen.add(f.id);
      out.push(f);
    }
  }

  return out.slice(0, SUGGEST_LIMIT);
}
