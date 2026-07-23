// Общие ярлыки/локаль для JSON-плоскости tarkov.dev. Плоскость отдаёт ТОЛЬКО
// плейсхолдеры имён ("{id} Nickname") — рабочей локали там нет (ни ?lang, ни
// Accept-Language, ни locale-эндпоинта; `translations` — лишь список JSONPath).
// Малые стабильные наборы (торговцы, станции убежища) держим ru сами — надёжнее и
// автономнее; normalizedName из фида реальный (идёт в иконки/ссылки).
import { fetchTarkovJson } from "@/lib/tarkov-fallback";

/** Барахолка как «вендор» в sellFor/buyFor (UI ищет её по normalizedName). */
export const FLEA_NORMALIZED_NAME = "flea-market";
export const FLEA_VENDOR_RU = "Барахолка";

export const TRADER_RU: Record<string, string> = {
  prapor: "Прапор",
  therapist: "Терапевт",
  fence: "Скупщик",
  skier: "Лыжник",
  peacekeeper: "Миротворец",
  mechanic: "Механик",
  ragman: "Барахольщик",
  jaeger: "Егерь",
  lightkeeper: "Смотритель",
  ref: "Реф",
};

export const STATION_RU: Record<string, string> = {
  medstation: "Медблок",
  "nutrition-unit": "Кухня",
  library: "Библиотека",
  heating: "Отопление",
  security: "Пункт охраны",
  "rest-space": "Комната отдыха",
  "hall-of-fame": "Зал славы",
  generator: "Генератор",
  "water-collector": "Водосборник",
  gym: "Спортзал",
  "booze-generator": "Самогонный аппарат",
  workbench: "Верстак",
  stash: "Схрон",
  "intelligence-center": "Разведцентр",
  vents: "Вентиляция",
  illumination: "Освещение",
  "weapon-rack": "Оружейная стойка",
  "shooting-range": "Тир",
  "scav-case": "Ящик Дикого",
  "cultist-circle": "Круг сектантов",
  "gear-rack": "Стойка снаряжения",
  "defective-wall": "Бракованная стена",
  "air-filtering-unit": "Система фильтрации воздуха",
  lavatory: "Санузел",
  "bitcoin-farm": "Ферма биткоинов",
  "solar-power": "Солнечная энергия",
};

export const MAP_RU: Record<string, string> = {
  factory: "Завод",
  "night-factory": "Завод (ночь)",
  customs: "Таможня",
  woods: "Лес",
  lighthouse: "Маяк",
  shoreline: "Берег",
  reserve: "Резерв",
  interchange: "Развязка",
  "streets-of-tarkov": "Улицы Таркова",
  "the-lab": "Лаборатория",
  "the-lab-dark": "Лаборатория (тьма)",
  "ground-zero": "Эпицентр",
  "ground-zero-21": "Эпицентр (21+)",
  "ground-zero-tutorial": "Эпицентр (обучение)",
  terminal: "Терминал",
  "the-labyrinth": "Лабиринт",
  icebreaker: "Ледокол",
};

/** Имя из JSON-плоскости — плейсхолдер ("{id}"/"{id} …")? Тогда его нельзя писать в
 *  БД поверх хорошего ru-имени (upsert должен сохранить старое). */
export function isPlaceholderName(name: string | undefined | null, id: string): boolean {
  if (!name) return true;
  return name === id || name.startsWith(`${id} `);
}

interface JsonEntity {
  id?: string;
  name?: string;
  normalizedName?: string;
}
type LabelMap = Map<string, { name: string; normalizedName: string }>;

async function labelMap(path: string, ru: Record<string, string>): Promise<LabelMap> {
  const map: LabelMap = new Map();
  try {
    const data = await fetchTarkovJson<Record<string, JsonEntity>>(path);
    for (const [id, e] of Object.entries(data)) {
      const nn = e.normalizedName ?? id;
      map.set(id, { normalizedName: nn, name: ru[nn] ?? nn });
    }
  } catch {
    /* best-effort: вызывающий подставит id вместо имени */
  }
  return map;
}

/** id торговца → { normalizedName, ru-имя } из /traders (best-effort). */
export const traderLabelMap = (gameMode: "regular" | "pve" = "regular"): Promise<LabelMap> =>
  labelMap(`${gameMode}/traders`, TRADER_RU);

/** id станции убежища → { normalizedName, ru-имя } из /hideout (best-effort). */
export const stationLabelMap = (gameMode: "regular" | "pve" = "regular"): Promise<LabelMap> =>
  labelMap(`${gameMode}/hideout`, STATION_RU);
