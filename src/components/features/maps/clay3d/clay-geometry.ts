// Построение геометрии клэй-карты из контуров. Доменная логика живёт здесь,
// а не в JSX (§4.7): компонент только монтирует сцену.
import * as THREE from 'three';
import type { ClayFloor, ClayStairs, FlatPolygon } from './clay-types';

/**
 * Выдавить плоские полигоны в объём и слить В ОДИН меш.
 *
 * ⚠️ Почему обязательно слияние. Узкое место сцены — не треугольники, а вызовы
 * отрисовки: на всю Таможню приходится 16 298 контуров, и отдельным мешем на
 * контур сцена умрёт задолго до того, как упрётся в 600 тыс. треугольников.
 * Поэтому на «этаж × роль» отдаётся ровно один буфер.
 *
 * Геометрия НЕиндексированная намеренно: нормали получаются плоскими, а именно
 * плоская грань и даёт «глиняный» вид. Индексация ради экономии здесь съела бы
 * фасетность и потребовала бы ручного расчёта нормалей.
 *
 * ОСИ: контур приходит как (x, z) в игровых метрах, высота идёт по Y —
 * в three.js Y вверх, как и в игре, поэтому перекладок нет.
 */
export function extrudePolygons(
  polygons: FlatPolygon[],
  baseY: number,
  height: number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const topY = baseY + height;
  let skipped = 0;

  for (const flat of polygons) {
    const n = flat.length >> 1;
    if (n < 3) continue;

    const pts: THREE.Vector2[] = new Array(n);
    for (let i = 0; i < n; i++) pts[i] = new THREE.Vector2(flat[i * 2], flat[i * 2 + 1]);

    // Обход нормализуем: триангуляция и боковые грани должны смотреть наружу
    // согласованно, иначе часть стен окажется вывернутой и почернеет.
    if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();

    const faces = THREE.ShapeUtils.triangulateShape(pts, []);

    for (const [a, b, c] of faces) {
      // ⚠️ Триангуляция изредка отдаёт индекс за пределами контура — на
      // вырожденных и самопересекающихся полигонах, которых в срезе стен
      // хватает. Одна такая грань роняла построение ВСЕЙ сцены
      // (`Cannot read properties of undefined`), поэтому пропускаем её и
      // считаем: молча терять геометрию нельзя.
      if (!pts[a] || !pts[b] || !pts[c]) {
        skipped += 1;
        continue;
      }
      // крышка — против часовой, смотрит вверх
      pos.push(pts[a].x, topY, pts[a].y);
      pos.push(pts[b].x, topY, pts[b].y);
      pos.push(pts[c].x, topY, pts[c].y);
      // дно — обратный обход, смотрит вниз
      pos.push(pts[c].x, baseY, pts[c].y);
      pos.push(pts[b].x, baseY, pts[b].y);
      pos.push(pts[a].x, baseY, pts[a].y);
    }

    // 🔴 ГОЧА: `triangulateShape` МУТИРУЕТ переданный массив — внутри она
    // вызывает removeDupEndPts и выбрасывает замыкающую точку, если та
    // совпадает с первой. Контур становится короче, а цикл боковых граней,
    // считавший по исходному `n`, читал за концом массива и ронял построение
    // ВСЕЙ сцены (`Cannot read properties of undefined (reading 'x')`).
    // Поэтому длину берём ЗАНОВО, уже после триангуляции.
    const m = pts.length;
    for (let i = 0; i < m; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % m];
      pos.push(p.x, baseY, p.y, q.x, baseY, q.y, q.x, topY, q.y);
      pos.push(p.x, baseY, p.y, q.x, topY, q.y, p.x, topY, p.y);
    }
  }

  if (skipped) {
    console.warn(`[clay3d] пропущено вырожденных граней: ${skipped}`);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Плоская поверхность пола: ТОЛЬКО верхние грани, без боков и дна.
 *
 * 🔴 ЗАЧЕМ ОТДЕЛЬНО ОТ ЭКСТРУЗИИ. Пол мостится сотнями прямоугольников
 * (объединённый силуэт этажа, перекрытий ноль). Выдавленный в КОРОБКУ, каждый
 * из них получал боковые стенки, и на стыках соседних коробок эти стенки
 * вставали друг к другу — сцена покрывалась ступеньками и швами, читалось как
 * «лесенка из наложенных полов» (замечание V4DYA).
 *
 * У пола боков нет: это поверхность, а не объём. Соседние плитки сливаются в
 * сплошную плоскость, и от мощения не остаётся ни одного видимого стыка.
 */
export function flatPolygons(
  polygons: FlatPolygon[],
  y: number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const flat of polygons) {
    const n = flat.length >> 1;
    if (n < 3) continue;
    const pts: THREE.Vector2[] = new Array(n);
    for (let i = 0; i < n; i++) pts[i] = new THREE.Vector2(flat[i * 2], flat[i * 2 + 1]);
    if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(pts, [])) {
      if (!pts[a] || !pts[b] || !pts[c]) continue;
      pos.push(pts[a].x, y, pts[a].y);
      pos.push(pts[b].x, y, pts[b].y);
      pos.push(pts[c].x, y, pts[c].y);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export interface FloorGeometry {
  floor: ClayFloor;
  walls: THREE.BufferGeometry | null;
  plate: THREE.BufferGeometry | null;
}

export function buildFloors(floors: ClayFloor[]): FloorGeometry[] {
  return floors.map((f) => ({
    floor: f,
    // Пол — ПЛОСКОСТЬ чуть ниже отметки этажа, а не объём: коробки давали
    // ступеньки на стыках плиток.
    plate: f.plates.length ? flatPolygons(f.plates, f.z0 - 0.02) : null,
    walls: f.walls.length ? extrudePolygons(f.walls, f.z0, f.wallH) : null,
  }));
}

/** Разбор бинаря лестниц: заголовок (кол-во вершин, кол-во индексов), позиции, индексы. */
export function parseStairBin(buf: ArrayBuffer): {
  positions: Float32Array;
  indices: Uint32Array;
} {
  const head = new DataView(buf, 0, 8);
  const vertCount = head.getUint32(0, true);
  const idxCount = head.getUint32(4, true);
  const positions = new Float32Array(buf, 8, vertCount * 3);
  const indices = new Uint32Array(buf, 8 + vertCount * 12, idxCount);
  return { positions, indices };
}

/**
 * Меш лестниц: один `InstancedMesh` на прототип.
 *
 * Инстансинг выбран замером: запечь все экземпляры стоило бы 691 КБ против
 * 313 КБ прототипами с матрицами — выигрыш ×2.2 при том же виде.
 *
 * Трансформ приходит покомпонентно (позиция, кватернион, масштаб) и собирается
 * здесь через `compose`. Матрицей его слать нельзя: порядок хранения элементов
 * пришлось бы держать в голове на двух языках сразу.
 */
export function buildStairs(
  stairs: ClayStairs,
  bin: ArrayBuffer,
): THREE.InstancedMesh[] {
  const { positions, indices } = parseStairBin(bin);
  const out: THREE.InstancedMesh[] = [];
  const material = new THREE.MeshLambertMaterial({ color: 0x3a3a40 });

  stairs.protos.forEach((proto, pi) => {
    const items = stairs.instances.filter((i) => i.p === pi);
    if (!items.length) return;

    // Индексы прототипа локальны для его же блока вершин — сдвигаем.
    const idx = new Uint32Array(proto.idxCount);
    for (let i = 0; i < proto.idxCount; i++) idx[i] = indices[proto.idxOffset + i];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        positions.slice(proto.posOffset * 3, (proto.posOffset + proto.posCount) * 3),
        3,
      ),
    );
    geo.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
    geo.computeVertexNormals();

    const mesh = new THREE.InstancedMesh(geo, material, items.length);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    items.forEach((it, n) => {
      p.set(it.t[0], it.t[1], it.t[2]);
      q.set(it.q[0], it.q[1], it.q[2], it.q[3]);
      s.set(it.s[0], it.s[1], it.s[2]);
      mesh.setMatrixAt(n, m.compose(p, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = `stairs:${proto.key}`;
    out.push(mesh);
  });

  return out;
}
