// Модули убежища, «уже построенные» изданием игры. Накладываются на уровень ЧТЕНИЕМ
// (max(сохранённый, floor)), в стор прогресса НЕ пишутся — издание это внешний факт, а не
// пользовательский прогресс (реагирует на смену издания, не воюет с ручным сбросом модуля).
//
// Источник — deep-research 2026-08-21 (docs/research/eft-editions-hideout-bonuses.md). Схрон
// стартует с разного уровня по изданию (подтверждённые размеры ячеек → уровень модуля Схрона 1-4):
//   Standard 10×30 = L1 · Left Behind 10×40 = L2 · Prepare for Escape 10×50 = L3 ·
//   Edge of Darkness 10×68 = L4 (макс) · The Unheard 10×72 = L4 (+бонус-ячейки сверх макс. модуля).
// The Unheard дополнительно даёт построенный Круг сектантов (известный факт EFT; в ресёрче не
// доверифицирован из-за лимита сессии, но не опровергнут). Ключи изданий — из EditionType
// (Standard|LB|PFE|EOD|TUE). Карта расширяема одной строкой.
const EDITION_FLOORS: Record<string, Record<string, number>> = {
  Standard: { stash: 1 },
  LB: { stash: 2 },
  PFE: { stash: 3 },
  EOD: { stash: 4 },
  TUE: { stash: 4, 'cultist-circle': 1 },
};

/** Минимальный уровень станции, гарантированный изданием (0 — ничего не гарантирует). */
export function editionFloor(station: string, edition: string | null | undefined): number {
  return edition ? (EDITION_FLOORS[edition]?.[station] ?? 0) : 0;
}

// Крафты-анлоки изданий: crafts.gameEditions несёт коды tarkov.dev, профиль — EditionType
// (Standard|LB|PFE|EOD|TUE). Карта «какой EditionType покрывает код издания». `eod_tue_edition`
// доступен владельцам EOD ИЛИ TUE. Расширяется одной строкой.
const EDITION_CODE_COVER: Record<string, readonly string[]> = {
  standard: ['Standard'],
  left_behind: ['LB'],
  prepare_for_escape: ['PFE'],
  prepare_to_escape: ['PFE'],
  edge_of_darkness: ['EOD'],
  unheard_edition: ['TUE'],
  eod_tue_edition: ['EOD', 'TUE'],
};

/** Покрывает ли издание игрока код издания-анлока из tarkov.dev. Неизвестный код → false. */
export function editionCovers(playerEdition: string | null | undefined, code: string): boolean {
  if (!playerEdition) return false;
  return EDITION_CODE_COVER[code]?.includes(playerEdition) ?? false;
}

/** Владеет ли игрок любым из изданий, дающих крафт (пустой список → нет требования → true). */
export function ownsAnyEdition(playerEdition: string | null | undefined, codes: string[]): boolean {
  return codes.some((code) => editionCovers(playerEdition, code));
}
