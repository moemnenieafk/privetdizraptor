// Математика бюджета сезонных перков. Чистые функции, без React — правило проекта:
// расчёты живут отдельно от UI, чтобы их можно было проверять и переиспользовать
// (конструктор, шаринг билда по коду, будущий каталог сборок сообщества).
import type { Season, SeasonPerk } from '@/data/eft-seasons';

export interface BudgetState {
  /** Сколько очков дали негативные перки (всегда ≥ 0). */
  granted: number;
  /** Сколько очков потрачено на позитивные (всегда ≥ 0). */
  spent: number;
  /** Остаток. Билд валиден, пока баланс ≥ 0. */
  balance: number;
  valid: boolean;
}

export type BlockReason =
  | { kind: 'points'; missing: number }
  | { kind: 'conflict'; withId: string; withName: string };

export interface PerkState {
  selected: boolean;
  /** Почему перк нельзя взять прямо сейчас. null — можно. */
  blocked: BlockReason | null;
}

const byId = (season: Season): Map<string, SeasonPerk> =>
  new Map(season.perks.map((p) => [p.id, p]));

/** Личные перки — сезонные в бюджете не участвуют (они навязаны всем). */
export const personalPerks = (season: Season): SeasonPerk[] =>
  season.perks.filter((p) => p.kind !== 'season');

export const seasonPerks = (season: Season): SeasonPerk[] =>
  season.perks.filter((p) => p.kind === 'season');

export function computeBudget(season: Season, selectedIds: string[]): BudgetState {
  const map = byId(season);
  let granted = 0;
  let spent = 0;

  for (const id of selectedIds) {
    const perk = map.get(id);
    if (!perk || perk.kind === 'season') continue;
    if (perk.cost > 0) granted += perk.cost;
    else spent += -perk.cost;
  }

  const balance = granted - spent;
  return { granted, spent, balance, valid: balance >= 0 };
}

/**
 * Состояние каждого личного перка при текущем выборе.
 *
 * Позитивный перк блокируется, если на него не хватает очков — это и есть весь смысл
 * системы: чтобы взять «Каппу» (−21), надо сначала набрать боль. Негативные не
 * блокируются никогда (они только добавляют очки).
 *
 * Отдельно — конфликты: пары с взаимно гасящими эффектами (см. excludes в данных).
 */
export function perkStates(
  season: Season,
  selectedIds: string[],
): Record<string, PerkState> {
  const map = byId(season);
  const selected = new Set(selectedIds);
  const { balance } = computeBudget(season, selectedIds);

  const states: Record<string, PerkState> = {};

  for (const perk of personalPerks(season)) {
    const isSelected = selected.has(perk.id);

    if (isSelected) {
      states[perk.id] = { selected: true, blocked: null };
      continue;
    }

    // Конфликт важнее нехватки очков: сначала объясняем, что перк бессмыслен.
    const conflictId = (perk.excludes ?? []).find((id) => selected.has(id));
    if (conflictId) {
      states[perk.id] = {
        selected: false,
        blocked: {
          kind: 'conflict',
          withId: conflictId,
          withName: map.get(conflictId)?.name ?? conflictId,
        },
      };
      continue;
    }

    if (perk.cost < 0) {
      const price = -perk.cost;
      if (price > balance) {
        states[perk.id] = {
          selected: false,
          blocked: { kind: 'points', missing: price - balance },
        };
        continue;
      }
    }

    states[perk.id] = { selected: false, blocked: null };
  }

  return states;
}

/**
 * Снятие негативного перка может увести баланс в минус — тогда «оплаченные» им
 * позитивные перки повисают в воздухе. Возвращаем, что придётся снять следом,
 * чтобы интерфейс мог предупредить, а не молча сломать билд.
 */
export function dropCascade(
  season: Season,
  selectedIds: string[],
  removingId: string,
): string[] {
  const next = selectedIds.filter((id) => id !== removingId);
  const { balance } = computeBudget(season, next);
  if (balance >= 0) return [];

  const map = byId(season);
  // Снимаем самые дорогие позитивные, пока баланс не выправится: дешёвые перки
  // игрок обычно ценит меньше, а дорогой всё равно «не по карману» без донора очков.
  const positives = next
    .map((id) => map.get(id))
    .filter((p): p is SeasonPerk => !!p && p.cost < 0)
    .sort((a, b) => a.cost - b.cost);

  const toDrop: string[] = [];
  let debt = -balance;

  for (const p of positives) {
    if (debt <= 0) break;
    toDrop.push(p.id);
    debt -= -p.cost;
  }

  return toDrop;
}

/** Компактный код билда для ссылки: перки по алфавиту через точку. */
export const encodeBuild = (selectedIds: string[]): string =>
  [...selectedIds].sort().join('.');

export const decodeBuild = (season: Season, code: string): string[] => {
  const known = new Set(personalPerks(season).map((p) => p.id));
  return code
    .split('.')
    .map((s) => s.trim())
    .filter((id) => known.has(id));
};
