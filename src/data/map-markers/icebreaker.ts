import type { ManualMapMarker } from './types';

/**
 * Ручные маркеры Ледокола — перенос с tarkov-market (идентичный арт → позиции 1:1).
 * Координаты вычислены из геометрии их svg-арта (x=svgX, z=8400−svgY). floor — индекс
 * buildMapFloors (0 = «Лазарет»). tarkov.dev по карте даёт только спавны/боссов → вручную.
 * Метод/гочи: скилл .claude/skills/import-external-map-markers.
 *
 * СТАТУС (2026-06-30, прервано отключением света): 53 маркера, этажи 0,1,2,4,5,6,7,8,9,10,12,13.
 * НЕ сняты: floor 3 (−1 Топливные), floor 11 (Лестница — закрыто, вероятно пусто). Квесты — не начаты.
 * Классы спавнов (отступник↔blackdiv) и плотность — под ревью V4DYA.
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
  // floor 5 — Вертолётная площадка (2); трапы (жёлтые полосы) пропущены
  { id: 'extract-pmc-2433-5734-f5', type: 'extract', floor: 5, x: 2433, z: 5734, faction: 'pmc', label: 'Вертолётная площадка' },
  { id: 'spawn-blackdiv-2479-5355-f5', type: 'spawn', floor: 5, x: 2479, z: 5355, category: 'blackdiv' },
  { id: 'spawn-blackdiv-2756-4103-f5', type: 'spawn', floor: 5, x: 2756, z: 4103, category: 'blackdiv' },
  // floor 6 — Спортзал / Столовая (3); трапы + «веер» пропущены
  { id: 'spawn-boss-2492-3449-f6', type: 'spawn', floor: 6, x: 2492, z: 3449, category: 'boss', label: 'Wedge' },
  { id: 'lock-2766-3721-f6', type: 'lock', floor: 6, x: 2766, z: 3721 },
  { id: 'lock-2311-3584-f6', type: 'lock', floor: 6, x: 2311, z: 3584 },
  { id: 'lock-2311-3380-f6', type: 'lock', floor: 6, x: 2311, z: 3380 },
  { id: 'lock-2687-3380-f6', type: 'lock', floor: 6, x: 2687, z: 3380 },
  { id: 'loot-keycards-2563-3477-f6', type: 'loot', floor: 6, x: 2563, z: 3477, category: 'keycards' },
  { id: 'loot-keycards-2400-3435-f6', type: 'loot', floor: 6, x: 2400, z: 3435, category: 'keycards' },
  { id: 'loot-mechkeys-2411-3164-f6', type: 'loot', floor: 6, x: 2411, z: 3164, category: 'mechkeys' },
  { id: 'loot-mechkeys-2572-3164-f6', type: 'loot', floor: 6, x: 2572, z: 3164, category: 'mechkeys' },
  { id: 'loot-mechkeys-2406-3111-f6', type: 'loot', floor: 6, x: 2406, z: 3111, category: 'mechkeys' },
  { id: 'loot-keycards-2288-3038-f6', type: 'loot', floor: 6, x: 2288, z: 3038, category: 'keycards' },
  { id: 'loot-keycards-2457-3011-f6', type: 'loot', floor: 6, x: 2457, z: 3011, category: 'keycards' },
  { id: 'loot-keycards-2549-3004-f6', type: 'loot', floor: 6, x: 2549, z: 3004, category: 'keycards' },
  // floor 7 — Жилой отсек 1 (4), «Archives»; трапы + «веер» пропущены
  { id: 'lock-2311-3592-f7', type: 'lock', floor: 7, x: 2311, z: 3592 },
  { id: 'lock-2687-3390-f7', type: 'lock', floor: 7, x: 2687, z: 3390 },
  { id: 'lock-2687-3143-f7', type: 'lock', floor: 7, x: 2687, z: 3143 },
  { id: 'lock-2363-3078-f7', type: 'lock', floor: 7, x: 2363, z: 3078 },
  { id: 'lock-2631-3078-f7', type: 'lock', floor: 7, x: 2631, z: 3078 },
  { id: 'lock-code-2357-3157-f7', type: 'lock', floor: 7, x: 2357, z: 3157, label: 'Код' },
  // floor 7 — носовая секция (Жилой отсек 1); трапы пропущены
  { id: 'loot-flare-2452-5043-f7', type: 'loot', floor: 7, x: 2452, z: 5043, label: 'Сигнальная ракета' },
  { id: 'loot-flare-2544-5039-f7', type: 'loot', floor: 7, x: 2544, z: 5039, label: 'Сигнальная ракета' },
  // floor 8 — Жилой отсек 2 (5), «Conference Room»; трапы пропущены
  { id: 'lock-2690-3556-f8', type: 'lock', floor: 8, x: 2690, z: 3556 },
  { id: 'lock-2365-3353-f8', type: 'lock', floor: 8, x: 2365, z: 3353 },
  { id: 'lock-2629-3353-f8', type: 'lock', floor: 8, x: 2629, z: 3353 },
  { id: 'lock-2308-3240-f8', type: 'lock', floor: 8, x: 2308, z: 3240 },
  { id: 'lock-code-2678-3444-f8', type: 'lock', floor: 8, x: 2678, z: 3444, label: 'Код' },
  // floor 9 — Жилой отсек 3 (6); трапы + «веер» пропущены
  { id: 'lock-2339-3651-f9', type: 'lock', floor: 9, x: 2339, z: 3651 },
  { id: 'lock-2659-3651-f9', type: 'lock', floor: 9, x: 2659, z: 3651 },
  // floor 10 — Палуба офицеров (7), HVAC/Lounge/Office; трапы + «веер» пропущены
  { id: 'lock-2337-3634-f10', type: 'lock', floor: 10, x: 2337, z: 3634 },
  { id: 'lock-2658-3634-f10', type: 'lock', floor: 10, x: 2658, z: 3634 },
  { id: 'lock-2633-3476-f10', type: 'lock', floor: 10, x: 2633, z: 3476 },
  { id: 'spawn-blackdiv-2495-3270-f10', type: 'spawn', floor: 10, x: 2495, z: 3270, category: 'blackdiv' },
  // floor 12 — Мостик (9), «Bridge»; трапы пропущены, тёмные квадраты = консоли (не маркеры)
  { id: 'loot-flare-2414-3267-f12', type: 'loot', floor: 12, x: 2414, z: 3267, label: 'Сигнальная ракета' },
  { id: 'loot-keycards-2565-3253-f12', type: 'loot', floor: 12, x: 2565, z: 3253, category: 'keycards' },
  // floor 13 — Крыша мостика (10); цилиндры/круги = вентиляция (не маркеры)
  { id: 'lock-hatch-2536-3300-f13', type: 'lock', floor: 13, x: 2536, z: 3300, label: 'Люк (Hatch)' },
];
