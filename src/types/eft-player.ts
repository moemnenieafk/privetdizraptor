// Типы внешнего лукапа игроков EFT (публичный профиль BSG, проксируем через player.tarkov.dev).
// RAW-* — форма ответа апстрима (как есть, минимально необходимое подмножество).
// PlayerView / RaidStatLine — нормализованная вью-модель для рендера.

/** Счётчик статистики: составной ключ + значение. */
export interface RawCounterItem {
  Key: string[];
  Value: number;
}

export interface RawOverallCounters {
  Items: RawCounterItem[];
}

/** Статистика одной стороны (PMC/Scav). */
export interface RawSideStats {
  eft?: {
    totalInGameTime?: number;
    overAllCounters?: RawOverallCounters;
  };
}

export interface RawCommonSkill {
  Id: string;
  Progress: number;
  LastAccess: number;
}

export interface RawSkills {
  Common?: RawCommonSkill[];
}

export interface RawPlayerInfo {
  nickname: string;
  side: string;
  experience: number;
  memberCategory: number;
  prestigeLevel: number;
  registrationDate?: number;
}

/** Ответ апстрима на /account/{aid}. Читаем только то, что рендерим. */
export interface RawPlayerProfile {
  aid: number;
  info: RawPlayerInfo;
  pmcStats?: RawSideStats;
  scavStats?: RawSideStats;
  skills?: RawSkills;
  stat?: { totalInGameTime?: number };
}

/** Элемент результата поиска /name/{nick}. */
export interface PlayerSearchHit {
  aid: number;
  name: string;
}

export const GAME_MODES = ["regular", "pve"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export function isGameMode(v: string): v is GameMode {
  return (GAME_MODES as readonly string[]).includes(v);
}

export type RaidSide = "PMC" | "Scav" | "Total";

/** Нормализованная строка рейд-статистики (одна на сторону + Total). */
export interface RaidStatLine {
  side: RaidSide;
  raids: number;
  survived: number;
  runthrough: number;
  mia: number;
  kia: number;
  kills: number;
  killsPmc: number;
  streak: number;
  /** % выживаний (survived / raids). 0 если рейдов нет. */
  survivalRate: number;
  /** K/D (kills / kia). Если смертей 0 — равно kills. */
  kdr: number;
}

export interface PlayerSkillView {
  id: string;
  progress: number;
}

/** Вью-модель профиля для страницы /eft/comlink/players/[mode]/[aid]. */
export interface PlayerView {
  aid: number;
  nickname: string;
  side: string;
  /** BEAR / USEC / SCAV / оригинал в верхнем регистре. */
  sideLabel: string;
  experience: number;
  prestige: number;
  /** Спец-бейджи из memberCategory (EOD, Unheard, Sherpa, Emissary…). */
  badges: string[];
  registrationDate: number | null;
  totalTimeSeconds: number;
  raidStats: RaidStatLine[];
  skills: PlayerSkillView[];
  gameMode: GameMode;
}
