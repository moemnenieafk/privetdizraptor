// Калибровка game→canvas для ТАЙЛОВЫХ карт (Завод): editorial-метки там в canvas-space 0–256,
// а скриншот EFT даёт игровые x,z. Аффин 2×3 ловит масштаб, сдвиг, поворот и зеркало осей.
//   canvasX = a·x + b·z + c
//   canvasY = d·x + e·z + f
// Коэффициенты [a,b,c,d,e,f] считаются офлайн из опорных точек (solveAffine) и кладутся в
// EFT_MAP_CONFIG.<map>.worldTransform. На SVG-картах это НЕ нужно (CRS сам проецирует игровые).
// Решение: docs/decisions/marker-by-screenshot.md.

export type WorldTransform = [number, number, number, number, number, number];

export interface CalibPoint {
  gameX: number;
  gameZ: number;
  canvasX: number;
  canvasY: number;
}

/** Применить аффин: игровые (x,z) → canvas (x,y). */
export function applyAffine(t: WorldTransform, gameX: number, gameZ: number): { x: number; z: number } {
  const [a, b, c, d, e, f] = t;
  return { x: a * gameX + b * gameZ + c, z: d * gameX + e * gameZ + f };
}

// Решить 3×3 систему методом Гаусса (частичный выбор ведущего). null — вырожденная (точки коллинеарны).
function solve3(m: number[][], v: number[]): [number, number, number] | null {
  const A = m.map((r, i) => [...r, v[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const k = A[r][col] / A[col][col];
      for (let cc = col; cc < 4; cc++) A[r][cc] -= k * A[col][cc];
    }
  }
  return [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
}

/**
 * Аффин game→canvas методом наименьших квадратов из ≥3 неколлинеарных точек.
 * Две независимые линейные регрессии (canvasX и canvasY по [x, z, 1]) через нормальные уравнения.
 * Возвращает [a,b,c,d,e,f] или null (мало точек / коллинеарны).
 */
export function solveAffine(pts: CalibPoint[]): WorldTransform | null {
  if (pts.length < 3) return null;
  // Нормальная матрица NᵀN для базиса [x, z, 1] — общая для обеих осей.
  const N = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const bx = [0, 0, 0];
  const bz = [0, 0, 0];
  for (const p of pts) {
    const row = [p.gameX, p.gameZ, 1];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) N[i][j] += row[i] * row[j];
      bx[i] += row[i] * p.canvasX;
      bz[i] += row[i] * p.canvasY;
    }
  }
  const cx = solve3(N, bx); // [a, b, c]
  const cz = solve3(N, bz); // [d, e, f]
  if (!cx || !cz) return null;
  return [cx[0], cx[1], cx[2], cz[0], cz[1], cz[2]];
}

/** Максимальная невязка подгонки (px холста) — контроль качества калибровки. */
export function maxResidual(t: WorldTransform, pts: CalibPoint[]): number {
  let max = 0;
  for (const p of pts) {
    const q = applyAffine(t, p.gameX, p.gameZ);
    max = Math.max(max, Math.hypot(q.x - p.canvasX, q.z - p.canvasY));
  }
  return max;
}
