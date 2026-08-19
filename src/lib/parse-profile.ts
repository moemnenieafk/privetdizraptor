// Плоский адаптер личного profile.json (shape docs/15045.json) → ParsedGameProfile —
// именно ту форму, которую читают будущий Досье-визуал, кнопка-шапка и апсерт в
// usePlayerStore. Тяжёлый разбор (уровень из опыта, счётчики рейдов, навыки) НЕ дублируем:
// делегируем существующим parseProfile/normalizeProfile (@/lib/tarkov/player-stats), а здесь
// только СПЛЮЩИВАЕМ PlayerView в контракт брифа и добираем memberCategory (его normalize роняет).
//
// §4.11: чистая клиентская функция, НИКАКИХ сетевых вызовов. Гарды на кривой/частичный JSON —
// возвращаем что смогли; нечитаемое числовое поле = null, «это вообще не профиль» = весь null.

import { parseProfile, normalizeProfile } from "@/lib/tarkov/player-stats";
import type { PlayerView, RaidStatLine } from "@/types/eft-player";

/** Ключевые pmc-показатели в плоском виде (side='PMC'-строка raidStats). null = не прочиталось. */
export interface ParsedPmcStats {
  /** Всего рейдов ЧВК (Sessions). */
  raids: number | null;
  /** Выжил (ExitStatus/Survived). */
  survived: number | null;
  /** Погиб в рейде — вынесен из игры (ExitStatus/Killed). */
  killed: number | null;
  /** Всего убийств. */
  kills: number | null;
  /** Смертей (Deaths). */
  deaths: number | null;
  /** K/D = kills/deaths (kills, если смертей 0). */
  kd: number | null;
  /** Выживаемость, % (survived+runner+transit)/raids. */
  survivalRate: number | null;
  /** Часы в рейдах (totalInGameTime → часы). */
  hoursPlayed: number | null;
  /** Самая длинная серия выживаний ЧВК (LongestWinStreak). */
  streak: number | null;
}

/** Верхушка навыков (по уровню) — для превью в Досье. */
export interface ParsedSkillTop {
  id: string;
  level: number;
}

/**
 * Плоский профиль ЧВК из личного экспорта. Три слоя идентичности НЕ смешаны: это только
 * EFT-факты из файла (архетип и standing — отдельные системы, здесь их нет).
 */
export interface ParsedGameProfile {
  nickname: string;
  /** Сырая сторона из файла ('Bear'/'Usec'/'Savage'…), не нормализованная. */
  side: string;
  /** Игровой опыт ЧВК (info.experience — накопленные очки уровня). null — не прочитан. */
  experience: number | null;
  /** Уровень ЧВК (из накопленного опыта). null — опыт не прочитан. */
  level: number | null;
  /** Престиж. null — поля нет. */
  prestige: number | null;
  /** Битфлаги memberCategory (издание/статусы). null — поля нет. */
  memberCategory: number | null;
  pmcStats: ParsedPmcStats;
  /** Топ навыков по уровню (усечён вызывающим при показе). */
  skillsTop: ParsedSkillTop[];
  achievementsCount: number;
  /** Заработанные достижения (id из profile.json = id зеркала tarkov.dev). */
  achievementsEarned: string[];
}

const emptyPmc: ParsedPmcStats = {
  raids: null,
  survived: null,
  killed: null,
  kills: null,
  deaths: null,
  kd: null,
  survivalRate: null,
  hoursPlayed: null,
  streak: null,
};

/** Конечное число → оно само, иначе null (гард на NaN/undefined/Infinity). */
function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** totalInGameTime (сек) → целые часы. null — если времени нет/0. */
function hoursFrom(totalSeconds: number): number | null {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  return Math.trunc(totalSeconds / 3600);
}

/** Плоские pmc-показатели из PMC-строки raidStats нормализованного вью. */
function flattenPmc(view: PlayerView): ParsedPmcStats {
  const pmc: RaidStatLine | undefined = view.raidStats.find((r) => r.side === "PMC");
  if (!pmc) return { ...emptyPmc, hoursPlayed: hoursFrom(view.totalTimeSeconds) };
  return {
    raids: num(pmc.raids),
    survived: num(pmc.survived),
    killed: num(pmc.kia), // ExitStatus/Killed = гибель в рейде = Deaths-счётчик стороны
    kills: num(pmc.kills),
    deaths: num(pmc.kia),
    kd: num(Number(pmc.kdr.toFixed(2))),
    survivalRate: num(Number(pmc.survivalRate.toFixed(1))),
    hoursPlayed: hoursFrom(view.totalTimeSeconds),
    streak: num(pmc.streak),
  };
}

/** Ключи объекта achievements (id заработанных достижений) — совпадают с id зеркала tarkov.dev. */
function readAchievementIds(json: unknown): string[] {
  if (typeof json !== "object" || json === null) return [];
  const a = (json as { achievements?: unknown }).achievements;
  if (typeof a !== "object" || a === null) return [];
  return Object.keys(a as Record<string, unknown>);
}

/** memberCategory сырьём из файла (normalizeProfile его не выносит наружу). */
function readMemberCategory(json: unknown): number | null {
  if (typeof json !== "object" || json === null) return null;
  const info = (json as { info?: unknown }).info;
  if (typeof info !== "object" || info === null) return null;
  return num((info as { memberCategory?: number }).memberCategory);
}

/**
 * profile.json (unknown) → плоский ParsedGameProfile. Возвращает null ТОЛЬКО если это не
 * профиль вовсе (нет aid/info/nickname — те же гарды, что у parseProfile). Частичный/битый
 * профиль не роняет: недостающие числа = null. Чистая, без I/O и сети (§4.11).
 */
export function parseGameProfile(json: unknown): ParsedGameProfile | null {
  const raw = parseProfile(json);
  if (!raw) return null;

  const view = normalizeProfile(raw);
  return {
    nickname: view.nickname,
    side: view.side,
    experience: num(view.experience),
    level: num(view.level),
    prestige: num(view.prestige),
    memberCategory: readMemberCategory(json),
    pmcStats: flattenPmc(view),
    skillsTop: view.skills.map((s) => ({ id: s.id, level: s.level })),
    achievementsCount: view.achievementsCount,
    achievementsEarned: readAchievementIds(json),
  };
}
