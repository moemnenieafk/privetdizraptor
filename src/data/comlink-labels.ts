// Общие словари меток раздела «Связь» — единый источник для списка кандидатов
// и публичного профиля /u/[username] (чтобы подписи не разъезжались).
import type { ComlinkGoal } from "@/db/schema-comlink";
import { EFT_MAP_CONFIG } from "@/data/eft-map-config";

export const GOAL_LABELS: Record<ComlinkGoal, string> = {
  partner: "Ищу напарника",
  team: "Ищу команду",
  student: "Хочу научиться",
  sherpa: "Готов обучать",
};

export const TIME_LABELS: Record<string, string> = {
  morning: "Утро",
  day: "День",
  evening: "Вечер",
  night: "Ночь",
};

export const STYLE_LABELS: Record<string, string> = {
  pvp: "ПВП",
  loot: "Лут",
  quests: "Квесты",
  chill: "Чилл",
};

export const MAP_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(EFT_MAP_CONFIG).map(([slug, c]) => [slug, c.displayName ?? slug]),
);
