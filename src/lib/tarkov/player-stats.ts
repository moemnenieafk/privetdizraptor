// Чистые хелперы лукапа игроков — без серверных импортов (безопасны и на клиенте).
import type {
  GameMode,
  PlayerSkillView,
  RaidSide,
  RaidStatLine,
  RawCounterItem,
  RawPlayerProfile,
  RawSideStats,
  PlayerView,
} from "@/types/eft-player";

/** Валидация ника BSG: латиница/цифры/-/_, 3–15 символов, либо TarkovCitizenNNN. */
export const PLAYER_NAME_RE = /^[a-zA-Z0-9-_]{3,15}$|^TarkovCitizen\d{1,10}$/i;
export const PLAYER_NAME_CHARSET_RE = /^[a-zA-Z0-9-_]*$/;

export function isValidPlayerName(name: string): boolean {
  return PLAYER_NAME_RE.test(name);
}

/** Битфлаги memberCategory → человекочитаемые бейджи. */
const MEMBER_FLAGS: ReadonlyArray<{ bit: number; label: string }> = [
  { bit: 2, label: "EOD" },
  { bit: 1024, label: "Unheard" },
  { bit: 256, label: "Sherpa" },
  { bit: 512, label: "Emissary" },
  { bit: 1, label: "Developer" },
  { bit: 32, label: "Moderator" },
];

export function memberBadges(memberCategory: number): string[] {
  if (!Number.isFinite(memberCategory) || memberCategory <= 0) return [];
  return MEMBER_FLAGS.filter((f) => (memberCategory & f.bit) === f.bit).map((f) => f.label);
}

export function sideLabel(side: string): string {
  const s = (side || "").toLowerCase();
  if (s === "savage") return "SCAV";
  return side ? side.toUpperCase() : "—";
}

/** Значение счётчика: элемент совпадает, если его Key содержит ВСЕ keyParts. */
export function extractCounter(items: RawCounterItem[], keyParts: string[]): number {
  const found = items.find((s) => keyParts.every((part) => s.Key.includes(part)));
  return found?.Value ?? 0;
}

const STAT_KEYS: ReadonlyArray<{ name: keyof Omit<RaidStatLine, "side" | "survivalRate" | "kdr">; key: string[] }> = [
  { name: "raids", key: ["Sessions"] },
  { name: "survived", key: ["ExitStatus", "Survived"] },
  { name: "runthrough", key: ["ExitStatus", "Runner"] },
  { name: "mia", key: ["ExitStatus", "Left"] },
  { name: "kia", key: ["ExitStatus", "Killed"] },
  { name: "kills", key: ["Kills"] },
  { name: "streak", key: ["LongestWinStreak"] },
  { name: "killsPmc", key: ["KilledPmc"] },
];

function emptyLine(side: RaidSide): RaidStatLine {
  return {
    side,
    raids: 0,
    survived: 0,
    runthrough: 0,
    mia: 0,
    kia: 0,
    kills: 0,
    killsPmc: 0,
    streak: 0,
    survivalRate: 0,
    kdr: 0,
  };
}

function derive(line: RaidStatLine): RaidStatLine {
  line.survivalRate = line.raids > 0 ? (line.survived / line.raids) * 100 : 0;
  line.kdr = line.kia > 0 ? line.kills / line.kia : line.kills;
  return line;
}

/** Собирает [Total, PMC, Scav] из pmcStats/scavStats. */
export function buildRaidStats(profile: RawPlayerProfile): RaidStatLine[] {
  const sides: Array<{ key: "pmcStats" | "scavStats"; side: RaidSide }> = [
    { key: "pmcStats", side: "PMC" },
    { key: "scavStats", side: "Scav" },
  ];
  const total = emptyLine("Total");
  const lines: RaidStatLine[] = [];

  for (const { key, side } of sides) {
    const items = (profile[key] as RawSideStats | undefined)?.eft?.overAllCounters?.Items;
    if (!items) continue;
    const line = emptyLine(side);
    for (const st of STAT_KEYS) {
      const v = extractCounter(items, st.key);
      line[st.name] = v;
      total[st.name] += v;
    }
    lines.push(derive(line));
  }

  // streak в Total — максимум, а не сумма (стрик — не аддитивная величина).
  total.streak = Math.max(...lines.map((l) => l.streak), 0);
  return [derive(total), ...lines];
}

export interface PlaytimeParts {
  hours: number;
  minutes: number;
}

export function playtime(totalSeconds: number): PlaytimeParts {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  return {
    hours: Math.trunc(safe / 3600),
    minutes: Math.trunc(safe / 60) % 60,
  };
}

function skills(profile: RawPlayerProfile): PlayerSkillView[] {
  const common = profile.skills?.Common;
  if (!common) return [];
  return common
    .filter((s) => s.Progress > 0 && s.LastAccess > 0)
    .map((s) => ({ id: s.Id, progress: s.Progress }))
    .sort((a, b) => b.progress - a.progress);
}

/** RAW-профиль → вью-модель. */
export function normalizeProfile(profile: RawPlayerProfile, gameMode: GameMode): PlayerView {
  const totalTimeSeconds =
    profile.pmcStats?.eft?.totalInGameTime ?? profile.stat?.totalInGameTime ?? 0;

  return {
    aid: profile.aid,
    nickname: profile.info?.nickname ?? "—",
    side: profile.info?.side ?? "",
    sideLabel: sideLabel(profile.info?.side ?? ""),
    experience: profile.info?.experience ?? 0,
    prestige: profile.info?.prestigeLevel ?? 0,
    badges: memberBadges(profile.info?.memberCategory ?? 0),
    registrationDate: profile.info?.registrationDate ?? null,
    totalTimeSeconds,
    raidStats: buildRaidStats(profile),
    skills: skills(profile),
    gameMode,
  };
}
