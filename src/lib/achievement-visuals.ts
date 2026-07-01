// Визуальный слой достижений: редкость (3 официальных тира BSG) + фракция.
// Pure-модуль (без server-импортов) — безопасен и в client-, и в server-компонентах.
//
// Цвета редкости переиспользуют существующие токены NIGHTFALL под игровую палитру
// (common=серый, rare=синий, legendary=золотой). Если V4DYA захочет выделенные
// --color-rarity-* — менять только здесь.

export type AchRarity = "common" | "rare" | "legendary";
export type AchSide = "pmc" | "scavs" | "all";

// Форма, которую рендерят и список, и деталь. Структурно совместима с AchievementDTO
// (из @/db/landing), поэтому серверная страница отдаёт DTO без маппинга — но клиент
// НЕ импортирует серверный модуль (иначе db в бандле).
export interface AchievementView {
  id: string;
  name: string;
  description: string;
  hidden: boolean;
  playersCompletedPercent: number;
  rarity: string;
  normalizedRarity: string;
  side: string;
  normalizedSide: string;
  adjustedPlayersCompletedPercent: number;
}

export interface RarityMeta {
  key: AchRarity;
  label: string;
  /** видимый цвет редкости для текста (rare — светлый #A069AF; тёмный #4C2A55 нечитаем как текст) */
  textClass: string;
  /** пилюля-бейдж: подложка /10 + обводка /50 + текст цвета редкости */
  badgeClass: string;
  /** класс рамки плитки */
  borderClass: string;
  /** класс подложки-тинта плитки (полупрозрачный оверлей /30) */
  tintClass: string;
}

// Цвета выверены V4DYA по градации Таркова (2026-07-02). Токены в globals.css, менять — здесь.
// Легендарное = #BDA550 (Каппа); редкое: подложка плитки = тёмный #4C2A55, бейдж/текст = светлый
// #A069AF (читаемость); обычное = серый text-secondary. Бейдж = подложка /10 + обводка /50 + текст.
const RARITY: Record<AchRarity, RarityMeta> = {
  common: {
    key: "common",
    label: "Обычное",
    textClass: "text-text-secondary",
    badgeClass: "border border-text-secondary/50 bg-text-secondary/10 text-text-secondary",
    borderClass: "border-lines-hover",
    tintClass: "bg-text-secondary/10",
  },
  rare: {
    key: "rare",
    label: "Редкое",
    textClass: "text-rarity-rare-badge",
    badgeClass: "border border-rarity-rare-badge/50 bg-rarity-rare-badge/10 text-rarity-rare-badge",
    borderClass: "border-rarity-rare/40",
    tintClass: "bg-rarity-rare/30",
  },
  legendary: {
    key: "legendary",
    label: "Легендарное",
    textClass: "text-rarity-legendary",
    badgeClass: "border border-rarity-legendary/50 bg-rarity-legendary/10 text-rarity-legendary",
    borderClass: "border-rarity-legendary/70",
    tintClass: "bg-rarity-legendary/30",
  },
};

export function rarityMeta(normalizedRarity: string): RarityMeta {
  return RARITY[normalizedRarity as AchRarity] ?? RARITY.common;
}

// Порядок сортировки «сначала престижные»: легендарное → редкое → обычное.
export const RARITY_RANK: Record<string, number> = { legendary: 0, rare: 1, common: 2 };

const SIDE_LABEL: Record<AchSide, string> = {
  pmc: "ЧВК",
  scavs: "Дикие",
  all: "Все",
};

export function sideLabel(normalizedSide: string): string {
  return SIDE_LABEL[normalizedSide as AchSide] ?? (normalizedSide || "—");
}

export const ALL_RARITIES: AchRarity[] = ["legendary", "rare", "common"];
export const ALL_SIDES: AchSide[] = ["pmc", "scavs", "all"];
