// Ёмкость Схрона в ячейках по изданию игры (T04).
// НЕ через editionFloor (тот отдаёт уровень модуля 1–4) — здесь нужно число ячеек,
// и EOD (680) ≠ TUE (720) при одном уровне модуля. Источник размеров — стартовая
// вместимость Схрона по изданию (deep-research 2026-08-21, eft-editions-hideout-bonuses).

/** Число ячеек Схрона по изданию: Standard 300 · LB 400 · PFE 500 · EOD 680 · TUE 720. */
const STASH_CELLS_BY_EDITION: Record<string, number> = {
  Standard: 300,
  LB: 400,
  PFE: 500,
  EOD: 680,
  TUE: 720,
};

const DEFAULT_STASH_CELLS = 300;

/** Возвращает вместимость Схрона в ячейках для издания. Неизвестное/пустое → 300. */
export function stashCapacityCells(edition: string | null | undefined): number {
  if (!edition) return DEFAULT_STASH_CELLS;
  return STASH_CELLS_BY_EDITION[edition] ?? DEFAULT_STASH_CELLS;
}
