// Каталог станций убежища EFT для РУЧНОГО редактора (Слой C профиля).
// Чистый модуль (§4.7): разметка редактора читает отсюда, сама ничего не решает.
//
// Ключ — числовой areaType (enum SPT/BSG), тот же, что в profile.json (Hideout.Areas[].type)
// и в PlayerManualOverrides.hideout / PlayerHideoutView.type. Имена зеркалят AREA_NAMES из
// db/game-changes.ts (единый источник, не форкаем).
//
// ⚠ maxLevel — ПРОВИЗОРНЫЙ (memory sprint-player-profile-persist: живого полного профиля с Hideout
//   нет). Значения кратны реальным потолкам станций EFT 1.0; редактор клампит по ним. Выверить против
//   реального профиля/зеркала hideout при появлении сэмпла — правится только число здесь.

export interface HideoutStation {
  /** areaType — enum станции (совпадает с profile.json Hideout.Areas[].type). */
  type: number;
  /** RU-имя (зеркалит AREA_NAMES). */
  name: string;
  /** Потолок уровня (0 = не построена). Провизорный — см. шапку. */
  maxLevel: number;
}

// Порядок — как в игровом меню убежища (сверху вниз, «жизнеобеспечение → производство → прочее»).
// Не-строящиеся/служебные типы (Ёлка, Зал славы декоративны) внизу; редактор их всё равно даёт —
// профиль полон только когда учтено всё.
export const HIDEOUT_STATIONS: readonly HideoutStation[] = [
  { type: 4, name: 'Генератор', maxLevel: 3 },
  { type: 5, name: 'Отопление', maxLevel: 3 },
  { type: 6, name: 'Сборник воды', maxLevel: 3 },
  { type: 17, name: 'Очистка воздуха', maxLevel: 1 },
  { type: 8, name: 'Кухня', maxLevel: 3 },
  { type: 9, name: 'Зона отдыха', maxLevel: 3 },
  { type: 7, name: 'Медблок', maxLevel: 3 },
  { type: 2, name: 'Санузел', maxLevel: 3 },
  { type: 1, name: 'Пункт охраны', maxLevel: 3 },
  { type: 0, name: 'Вентиляция', maxLevel: 3 },
  { type: 15, name: 'Освещение', maxLevel: 3 },
  { type: 3, name: 'Тайник', maxLevel: 4 },
  { type: 10, name: 'Верстак', maxLevel: 3 },
  { type: 11, name: 'Разведцентр', maxLevel: 3 },
  { type: 20, name: 'Bitcoin-ферма', maxLevel: 3 },
  { type: 14, name: 'Скав-кейс', maxLevel: 1 },
  { type: 19, name: 'Самогонный аппарат', maxLevel: 1 },
  { type: 18, name: 'Солнечная батарея', maxLevel: 1 },
  { type: 12, name: 'Тир', maxLevel: 1 },
  { type: 13, name: 'Библиотека', maxLevel: 1 },
  { type: 23, name: 'Спортзал', maxLevel: 1 },
  { type: 24, name: 'Стойка оружия', maxLevel: 3 },
  { type: 16, name: 'Зал славы', maxLevel: 3 },
  { type: 22, name: 'Аварийная стена', maxLevel: 6 },
  { type: 21, name: 'Ёлка', maxLevel: 1 },
];

/** Быстрый доступ type → станция (для резолва имени по type из view/manual). */
export const HIDEOUT_BY_TYPE: Readonly<Record<number, HideoutStation>> = Object.fromEntries(
  HIDEOUT_STATIONS.map((s) => [s.type, s]),
);
