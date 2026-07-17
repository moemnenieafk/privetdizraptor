// Чистые хелперы разбора личного профиля (без серверных импортов, безопасны на клиенте).
import type {
  PlayerMasteringView,
  PlayerSkillView,
  PlayerView,
  RaidSide,
  RaidStatLine,
  RawCounterItem,
  RawPlayerProfile,
  RawSideStats,
} from "@/types/eft-player";

/** Битфлаги memberCategory → бейджи (издания/статусы). */
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

/** Значение счётчика: элемент совпадает, если его Key содержит ВСЕ keyParts
 *  (сторона 'Pmc'/'Scav' в реальных ключах игнорируется — сторону задаёт объект). */
export function extractCounter(items: RawCounterItem[], keyParts: string[]): number {
  const found = items.find((s) => keyParts.every((part) => s.Key.includes(part)));
  return found?.Value ?? 0;
}

const STAT_KEYS: ReadonlyArray<{
  name: keyof Omit<RaidStatLine, "side" | "survivalRate" | "kdr">;
  key: string[];
}> = [
  { name: "raids", key: ["Sessions"] },
  { name: "survived", key: ["ExitStatus", "Survived"] },
  { name: "runthrough", key: ["ExitStatus", "Runner"] },
  { name: "transit", key: ["ExitStatus", "Transit"] },
  { name: "mia", key: ["ExitStatus", "MissingInAction"] },
  { name: "kia", key: ["Deaths"] },
  { name: "kills", key: ["Kills"] },
  { name: "killsPmc", key: ["KilledPmc"] },
  { name: "streak", key: ["LongestWinStreak"] },
];

function emptyLine(side: RaidSide): RaidStatLine {
  return {
    side,
    raids: 0,
    survived: 0,
    runthrough: 0,
    transit: 0,
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
  const alive = line.survived + line.runthrough + line.transit;
  line.survivalRate = line.raids > 0 ? (alive / line.raids) * 100 : 0;
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

  total.streak = Math.max(...lines.map((l) => l.streak), 0);
  return [derive(total), ...lines];
}

export interface PlaytimeParts {
  hours: number;
  minutes: number;
}

export function playtime(totalSeconds: number): PlaytimeParts {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  return { hours: Math.trunc(safe / 3600), minutes: Math.trunc(safe / 60) % 60 };
}

/** Уровень навыка из накопленного Progress (100 = уровень, максимум 51/elite). */
function skillLevel(progress: number): number {
  return Math.min(51, Math.floor(progress / 100));
}

function skills(profile: RawPlayerProfile): PlayerSkillView[] {
  const common = profile.skills?.Common;
  if (!common) return [];
  return common
    .map((s) => ({ id: s.Id, level: skillLevel(s.Progress) }))
    .filter((s) => s.level > 0)
    .sort((a, b) => b.level - a.level);
}

function mastering(profile: RawPlayerProfile): PlayerMasteringView[] {
  const m = profile.skills?.Mastering;
  if (!m) return [];
  return m
    .filter((x) => x.Progress > 0)
    .map((x) => ({ id: x.Id, progress: Math.round(x.Progress) }))
    .sort((a, b) => b.progress - a.progress);
}

/** Проверка/типизация произвольного JSON как профиля. null — если это не профиль. */
export function parseProfile(data: unknown): RawPlayerProfile | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.aid !== "number") return null;
  if (typeof d.info !== "object" || d.info === null) return null;
  const info = d.info as Record<string, unknown>;
  if (typeof info.nickname !== "string") return null;
  return d as unknown as RawPlayerProfile;
}

/** RAW-профиль → вью-модель. */
export function normalizeProfile(profile: RawPlayerProfile): PlayerView {
  const totalTimeSeconds =
    profile.pmcStats?.eft?.totalInGameTime ?? profile.scavStats?.eft?.totalInGameTime ?? 0;

  return {
    aid: profile.aid,
    nickname: profile.info?.nickname ?? "—",
    side: profile.info?.side ?? "",
    sideLabel: sideLabel(profile.info?.side ?? ""),
    experience: profile.info?.experience ?? 0,
    prestige: profile.info?.prestigeLevel ?? 0,
    badges: memberBadges(profile.info?.memberCategory ?? 0),
    totalTimeSeconds,
    raidStats: buildRaidStats(profile),
    skills: skills(profile),
    mastering: mastering(profile),
    achievementsCount: profile.achievements ? Object.keys(profile.achievements).length : 0,
    updatedAt: profile.updated ?? null,
  };
}
