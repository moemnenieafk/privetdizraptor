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

// ── Убежище/трейдеры: ЕСТЬ только в ПОЛНОМ игровом/SPT-профиле, НЕ в тонком экспорте
//    tarkov.dev/players (там лишь aid/info/pmcStats/scavStats/skills). Парсим if-present. ──
export interface RawHideoutArea {
  /** Числовой enum станции убежища. */
  type: number;
  /** Текущий уровень станции (0 = не построена). */
  level: number;
}

export interface RawTraderInfo {
  unlocked?: boolean;
  loyaltyLevel?: number;
  standing?: number;
  salesSum?: number;
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
  /** Убежище — только в полном игровом/SPT-профиле (у тонкого tarkov.dev-экспорта нет). */
  Hideout?: { Areas?: RawHideoutArea[] };
  /** Трейдеры (лояльность/репутация) — тоже только в полном профиле. Ключ — traderId. */
  TradersInfo?: Record<string, RawTraderInfo>;
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

export interface PlayerHideoutView {
  /** Числовой enum станции (маппинг type→имя/иконка — на стороне UI). */
  type: number;
  level: number;
}

export interface PlayerTraderView {
  id: string;
  loyaltyLevel: number;
  standing: number | null;
}

export type ProfileEdition = "Standard" | "LB" | "PFE" | "EOD" | "TUE";

/** Вью-модель для рендера загруженного профиля. */
export interface PlayerView {
  aid: number;
  nickname: string;
  side: string;
  sideLabel: string;
  experience: number;
  level: number;
  edition: ProfileEdition;
  prestige: number;
  badges: string[];
  totalTimeSeconds: number;
  raidStats: RaidStatLine[];
  skills: PlayerSkillView[];
  mastering: PlayerMasteringView[];
  /** Убежище (станция→уровень). Пусто для тонкого профиля — источник только полный/ручной ввод. */
  hideout: PlayerHideoutView[];
  /** Трейдеры (лояльность). Пусто для тонкого профиля. */
  traders: PlayerTraderView[];
  achievementsCount: number;
  updatedAt: number | null;
}

// ── Серверный снапшот профиля (Слой B): JSONB в cta_player_profiles. Хранит ТОЛЬКО то, что уникально
//    Слою B — рич-вью ЧВК (usePmcStatsStore: навыки/мастерство/рейды) + ручные оверрайды (Слой C).
//    Идентичность (usePlayerStore: ник/уровень/K:D/трейдеры, мультипрофиль) ведёт СЛОЙ 4d
//    (PlayerProfileSync + /api/eft/player-profile) — здесь НЕ дублируется, чтобы две системы не
//    конкурировали за одни поля (баг «стата сбрасывается при загрузке», 2026-08). ──
export type ProfileSource = "tarkov.dev" | "game-profile" | "manual" | "mixed";

/** Ручные оверрайды (Слой C): уровни, введённые без JSON. Ключи — id навыка / type станции / traderId. */
export interface PlayerManualOverrides {
  skills?: Record<string, number>;
  hideout?: Record<string, number>;
  traders?: Record<string, number>;
}

/** Снапшот Слоя B: рич-вью + ручные оверрайды. Идентичность — не здесь (см. коммент выше). */
export interface PlayerProfileSnapshot {
  view: PlayerView | null;
  manual?: PlayerManualOverrides;
  source: ProfileSource;
}
