import type { ManualMapMarker } from './types';

/**
 * Ручные маркеры Ледокола — перенос с tarkov-market (идентичный арт → позиции 1:1).
 * Координаты вычислены из геометрии их svg-арта (x=svgX, z=8400−svgY). floor — индекс
 * buildMapFloors (0 = «Лазарет»). tarkov.dev по карте даёт только спавны/боссов → вручную.
 *
 * СТАТУС: пилот «Лазарет» (floor 0), нижняя секция. Классы спавнов — под ревью V4DYA.
 */
export const icebreakerMarkers: ManualMapMarker[] = [
  // floor 0 — Лазарет · нижняя секция (Laboratory / Wardr.)
  { id: 'spawn-blackdiv-2475-3280-f0', type: 'spawn', floor: 0, x: 2475, z: 3280, category: 'blackdiv' },
  { id: 'switch-2212-3163-f0', type: 'switch', floor: 0, x: 2212, z: 3163 },
  { id: 'lock-2229-3163-f0', type: 'lock', floor: 0, x: 2229, z: 3163 },
  // нижняя оконечность (под Laboratory)
  { id: 'spawn-pmc-2500-2224-f0', type: 'spawn', floor: 0, x: 2500, z: 2224, category: 'pmc' },
  { id: 'loot-flare-2478-2657-f0', type: 'loot', floor: 0, x: 2478, z: 2657, label: 'Сигнальная ракета' },
  // секция мед-блока (Dentist / Down)
  { id: 'loot-keycards-2501-3614-f0', type: 'loot', floor: 0, x: 2501, z: 3614, category: 'keycards' },
  // машинное отделение — жёлтые полосы = трапы/лестницы (условное обозначение, НЕ маркеры → пропущены)
  { id: 'spawn-blackdiv-2739-4681-f0', type: 'spawn', floor: 0, x: 2739, z: 4681, category: 'blackdiv' },
  // floor 2 — Машинное отделение (−2); жёлтые полосы = трапы (пропущены)
  { id: 'spawn-blackdiv-2523-4632-f2', type: 'spawn', floor: 2, x: 2523, z: 4632, category: 'blackdiv' },
  { id: 'lock-code-2294-4613-f2', type: 'lock', floor: 2, x: 2294, z: 4613, label: 'Код (для панели ниже)' },
  // floor 1 — Нижняя автоматика (−3); жёлтая полоса = трап (пропущена)
  { id: 'lock-panel-2499-4632-f1', type: 'lock', floor: 1, x: 2499, z: 4632, label: 'Кодовая панель' },
  // floor 4 — Склад / Охрана (0); жёлтый «веер» = деталь арта (пропущен)
  { id: 'spawn-blackdiv-2477-3263-f4', type: 'spawn', floor: 4, x: 2477, z: 3263, category: 'blackdiv' },
  { id: 'spawn-boss-2533-3263-f4', type: 'spawn', floor: 4, x: 2533, z: 3263, category: 'boss', label: 'Wedge' },
  { id: 'lock-2242-3544-f4', type: 'lock', floor: 4, x: 2242, z: 3544 },
  { id: "spawn-blackdiv-2422-4725-f4", type: "spawn", floor: 4, x: 2422.2, z: 4724.9, category: "blackdiv" },
  { id: "spawn-blackdiv-2570-4727-f4", type: "spawn", floor: 4, x: 2569.6, z: 4726.7, category: "blackdiv" },
];
