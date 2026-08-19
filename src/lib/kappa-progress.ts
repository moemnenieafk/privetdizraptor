import { COLLECTOR_QUEST_ID } from './quest-constants';

// Прогресс трекера «Коллекционер» (контейнер Kappa) как ПРОИЗВОДНАЯ из локального прогресса
// квестов. Единый источник и для Досье (/eft/hub), и для инференса архетипа (role-inference).
// Считается по НАБОРУ objective-id'ов Каппы (kappaObjectiveIds в useQuestStore), который сервер
// засевает и персистит — поэтому Каппа считается без рантайм-tasks и переживает refresh (факт B сверки).

export interface KappaProgress {
  found: number;
  total: number;
  /** Доля собранного 0..1 — для инференса роли. total=0 → 0 (набор ещё не засеян). */
  ratio: number;
  /** Округлённый процент 0..100 — для UI. */
  pct: number;
}

const EMPTY: KappaProgress = { found: 0, total: 0, ratio: 0, pct: 0 };

/** found — отметки (count ≥ 1) в itemProgress квеста Каппы среди переданных objective-id'ов. */
export function kappaProgressFromIds(
  objectiveIds: string[],
  itemProgress: Record<string, Record<string, number>>,
): KappaProgress {
  const total = objectiveIds.length;
  if (total === 0) return EMPTY;
  const progress = itemProgress[COLLECTOR_QUEST_ID] ?? {};
  const found = objectiveIds.reduce((n, id) => n + ((progress[id] ?? 0) >= 1 ? 1 : 0), 0);
  const ratio = found / total;
  return { found, total, ratio, pct: Math.round(ratio * 100) };
}
