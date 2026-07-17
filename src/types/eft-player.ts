// Типы профиля EFT из ЛИЧНОГО экспорта игрока (кнопка «Скачать JSON» на профиле).
// Юзер — владелец данных; парсим их у себя и рисуем стату. Без апстрима/капчи.
// RAW-* — форма файла (подмножество, что рендерим). PlayerView — вью-модель.

export interface RawCounterItem {
  Key: string[];
  Value: number;
}

export interface RawOverallCounters {
  Items: RawCounterItem[];
}

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

export interface RawMastering {
  Id: string;
  Progress: number;
  Kills?: number;
}

export interface RawSkills {
  Common?: RawCommonSkill[];
  Mastering?: RawMastering[];
  Points?: number;
}

export interface RawPlayerInfo {
  nickname: string;
  side: string;
  experience: number;
  memberCategory: number;
  selectedMemberCategory?: number;
  prestigeLevel: number;
  registrationDate?: number;
}

/** Форма файла profile.json (то, что реально читаем). */
export interface RawPlayerProfile {
  aid: number;
  info: RawPlayerInfo;
  skills?: RawSkills;
  achievements?: Record<string, number>;
  pmcStats?: RawSideStats;
  scavStats?: RawSideStats;
  updated?: number;
}

export const GAME_MODES = ["regular", "pve"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export function isGameMode(v: string): v is GameMode {
  return (GAME_MODES as readonly string[]).includes(v);
}

export type RaidSide = "PMC" | "Scav" | "Total";

/** Нормализованная строка рейд-статистики (на сторону + Total). */
export interface RaidStatLine {
  side: RaidSide;
  raids: number;
  survived: number;
  runthrough: number;
  transit: number;
  mia: number;
  kia: number;
  kills: number;
  killsPmc: number;
  streak: number;
  /** % «не смертей»: (survived+runner+transit)/raids. */
  survivalRate: number;
  /** K/D = kills / kia. Если смертей 0 — равно kills. */
  kdr: number;
}

export interface PlayerSkillView {
  id: string;
  /** Уровень навыка (floor(progress/100), макс 51). */
  level: number;
}

export interface PlayerMasteringView {
  id: string;
  progress: number;
}

/** Вью-модель для рендера загруженного профиля. */
export interface PlayerView {
  aid: number;
  nickname: string;
  side: string;
  sideLabel: string;
  experience: number;
  prestige: number;
  badges: string[];
  totalTimeSeconds: number;
  raidStats: RaidStatLine[];
  skills: PlayerSkillView[];
  mastering: PlayerMasteringView[];
  achievementsCount: number;
  updatedAt: number | null;
}
