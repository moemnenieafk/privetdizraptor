import type { StashItem } from '@/types/barter';

function buildOccupancyGrid(
  items: StashItem[],
  rows: number,
  cols: number
): boolean[][] {
  const grid: boolean[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(false)
  );
  for (const item of items) {
    for (let r = item.row; r < item.row + item.height; r++) {
      for (let c = item.col; c < item.col + item.width; c++) {
        if (r < rows && c < cols) grid[r][c] = true;
      }
    }
  }
  return grid;
}

function canPlace(
  grid: boolean[][],
  row: number,
  col: number,
  w: number,
  h: number
): boolean {
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      if (grid[r]?.[c]) return false;
    }
  }
  return true;
}

export function findFirstFit(
  items: StashItem[],
  rows: number,
  cols: number,
  w: number,
  h: number
): { row: number; col: number } | null {
  if (w > cols) return null;
  const grid = buildOccupancyGrid(items, rows, cols);
  for (let r = 0; r <= rows - h; r++) {
    for (let c = 0; c <= cols - w; c++) {
      if (canPlace(grid, r, c, w, h)) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}
