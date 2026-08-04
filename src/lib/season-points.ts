// Математика бюджета сезонных перков. Чистые функции, без React — правило проекта:
// расчёты живут отдельно от UI, чтобы их можно было проверять и переиспользовать
// (конструктор, шаринг билда по коду, будущий каталог сборок сообщества).
import type { Season, SeasonPerk } from '@/data/eft-seasons';

export interface BudgetState {
  /** Сколько очков дали негативные перки (всегда ≥ 0). */
  granted: number;
  /** Сколько очков потрачено на позитивные (всегда ≥ 0). */
  spent: number;
  /** Остаток. Может уйти в минус — билд собирается свободно. */
  balance: number;
  /** Выбран ли хотя бы один негатив. Валидный персонаж без боли не существует. */
  hasNegative: boolean;
  /** Персонаж собран: баланс ≥ 0 И взят хотя бы 1 негативный модификатор. */
  valid: boolean;
}

// Единственная причина блокировки — взаимоисключающие перки. Нехватку очков больше
// не блокируем: позитивы выбираются свободно, минус баланса показываем в панели.
export type BlockReason = { kind: 'conflict'; withId: string; withName: string };

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
  let hasNegative = false;

  for (const id of selectedIds) {
    const perk = map.get(id);
    if (!perk || perk.kind === 'season') continue;
    if (perk.cost > 0) {
      granted += perk.cost;
      hasNegative = true;
    } else {
      spent += -perk.cost;
    }
  }

  const balance = granted - spent;
  return { granted, spent, balance, hasNegative, valid: balance >= 0 && hasNegative };
}

/**
 * Состояние каждого личного перка при текущем выборе.
 *
 * Свободный выбор: позитивы берутся когда угодно (баланс может уйти в минус — это
 * видно в панели, «добери N»). Единственная блокировка — конфликт: несовместимые
 * пары (см. excludes) — реальный запрет BSG, конструктор их не даёт совмещать.
 */
export function perkStates(
  season: Season,
  selectedIds: string[],
): Record<string, PerkState> {
  const map = byId(season);
  const selected = new Set(selectedIds);

  const states: Record<string, PerkState> = {};

  for (const perk of personalPerks(season)) {
    if (selected.has(perk.id)) {
      states[perk.id] = { selected: true, blocked: null };
      continue;
    }

    const conflictId = (perk.excludes ?? []).find((id) => selected.has(id));
    states[perk.id] = conflictId
      ? {
          selected: false,
          blocked: {
            kind: 'conflict',
            withId: conflictId,
            withName: map.get(conflictId)?.name ?? conflictId,
          },
        }
      : { selected: false, blocked: null };
  }

  return states;
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
