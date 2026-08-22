// src/lib/stash-packer.ts
// Чистая, детерминированная bin-packing раскладка футпринтов предметов
// в сетку фиксированной ширины (skyline / bottom-left).
// Без React, без побочек, без Date/random — одинаковый вход даёт одинаковый выход.

export interface StashEntry {
  id: string;
  count: number;
  gridWidth: number;
  gridHeight: number;
  rarity?: string;
}

export interface PackedCell {
  id: string;
  col: number;
  row: number;
  w: number;
  h: number;
} // 0-based col/row в единицах ячеек

export interface PackResult {
  cells: PackedCell[];
  columns: number;
  rows: number;
  occupied: number;
} // occupied = Σ w*h

const DEFAULT_COLUMNS = 10;

// Значимость редкости: чем больше — тем «выше» в сортировке (раньше кладётся).
// Неизвестная/отсутствующая редкость — низший приоритет.
const RARITY_ORDER: Record<string, number> = {
  orange: 6,
  red: 5,
  violet: 4,
  blue: 3,
  green: 2,
  black: 1,
  grey: 0,
};

function rarityRank(rarity: string | undefined): number {
  if (rarity == null) return -1;
  const rank = RARITY_ORDER[rarity.toLowerCase()];
  return rank === undefined ? -1 : rank;
}

/**
 * Раскладывает предметы в сетку из `columns` колонок без поворота.
 * Сортировка: площадь (w*h) убыв. → редкость убыв. → id (стабильность).
 * Одна StashEntry = одна PackedCell (модель B).
 */
export function packStash(entries: StashEntry[], columns: number = DEFAULT_COLUMNS): PackResult {
  const cols = Math.max(1, Math.floor(columns));

  const sorted = [...entries].sort((a, b) => {
    const areaA = a.gridWidth * a.gridHeight;
    const areaB = b.gridWidth * b.gridHeight;
    if (areaA !== areaB) return areaB - areaA; // площадь убыв.
    const rankA = rarityRank(a.rarity);
    const rankB = rarityRank(b.rarity);
    if (rankA !== rankB) return rankB - rankA; // редкость убыв.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // id возр. (стабильность)
  });

  // Высота (число занятых рядов) каждой колонки — линия горизонта.
  const heights: number[] = new Array<number>(cols).fill(0);
  const cells: PackedCell[] = [];
  let occupied = 0;

  for (const entry of sorted) {
    const w = Math.min(Math.max(1, Math.floor(entry.gridWidth)), cols); // кламп ширины к сетке
    const h = Math.max(1, Math.floor(entry.gridHeight));

    // Ищем позицию bottom-left: минимальный ряд, затем минимальная колонка.
    let bestCol = 0;
    let bestRow = Number.POSITIVE_INFINITY;

    for (let c = 0; c + w <= cols; c++) {
      // Ряд посадки = максимальная линия горизонта на перекрываемых колонках.
      let row = 0;
      for (let k = c; k < c + w; k++) {
        if (heights[k] > row) row = heights[k];
      }
      if (row < bestRow) {
        bestRow = row;
        bestCol = c;
      }
    }

    const placedRow = bestRow === Number.POSITIVE_INFINITY ? 0 : bestRow;

    cells.push({ id: entry.id, col: bestCol, row: placedRow, w, h });
    occupied += w * h;

    // Поднимаем линию горизонта на занятых колонках.
    for (let k = bestCol; k < bestCol + w; k++) {
      heights[k] = placedRow + h;
    }
  }

  let rows = 0;
  for (const height of heights) {
    if (height > rows) rows = height;
  }

  return { cells, columns: cols, rows, occupied };
}
