export type BadgeId = 'wholesaler' | 'speculator' | 'lighthouse-master';

export interface BadgeState {
  id: BadgeId;
  label: string;
  description: string;
  unlockedAt: number | null;
}

export interface TraderTier {
  level: number;
  label: string;
  xpRequired: number;
}

export const BADGE_DEFINITIONS: Omit<BadgeState, 'unlockedAt'>[] = [
  { id: 'wholesaler', label: 'Оптовик', description: 'Зафиксировал бартер с 5+ компонентами' },
  { id: 'speculator', label: 'Спекулянт', description: 'ROI превысил 200% по бартерной сделке' },
  { id: 'lighthouse-master', label: 'Мастер Маяка', description: 'Выполнил все бартеры Смотрителя' },
];

export const TRADER_TIERS: TraderTier[] = [
  { level: 1, label: 'НОВОБРАНЕЦ', xpRequired: 0 },
  { level: 2, label: 'ТОРГОВЕЦ', xpRequired: 50_000 },
  { level: 3, label: 'БАРЫГА', xpRequired: 250_000 },
  { level: 4, label: 'ДЕЛЕЦ', xpRequired: 1_000_000 },
  { level: 5, label: 'БАРОН', xpRequired: 5_000_000 },
];

// ─── PRO Meta-Progress ──────────────────────────────────

export interface ProChallenge {
  id: string;
  label: string;
  description: string;
}

export const PRO_CHALLENGES: ProChallenge[] = [
  { id: 'first-deal',   label: 'Первая сделка',  description: 'Зафиксировать первый бартер' },
  { id: 'wholesaler',   label: 'Оптовик',         description: 'Бартер с 5+ компонентами' },
  { id: 'speculator',   label: 'Спекулянт',       description: 'ROI > 200% по сделке' },
  { id: 'profit-100k',  label: 'Сотня тысяч',     description: 'Набрать 100 000 XP' },
  { id: 'profit-1m',    label: 'Миллион',          description: 'Набрать 1 000 000 XP' },
  { id: 'lighthouse',   label: 'Мастер Маяка',    description: 'Все бартеры Смотрителя' },
];

export const PRO_UNLOCK_AT = 4;

export function computeProStatus(
  xp: number,
  confirmedBarterIds: string[],
  badges: BadgeState[],
): { challenges: (ProChallenge & { completed: boolean })[]; completedCount: number; isUnlocked: boolean } {
  const badgeUnlocked = (id: BadgeId) =>
    badges.find((b) => b.id === id)?.unlockedAt !== null;

  const challenges = PRO_CHALLENGES.map((c) => {
    let completed = false;
    if (c.id === 'first-deal')  completed = confirmedBarterIds.length >= 1;
    if (c.id === 'wholesaler')  completed = badgeUnlocked('wholesaler');
    if (c.id === 'speculator')  completed = badgeUnlocked('speculator');
    if (c.id === 'profit-100k') completed = xp >= 100_000;
    if (c.id === 'profit-1m')   completed = xp >= 1_000_000;
    if (c.id === 'lighthouse')  completed = badgeUnlocked('lighthouse-master');
    return { ...c, completed };
  });

  const completedCount = challenges.filter((c) => c.completed).length;
  return { challenges, completedCount, isUnlocked: completedCount >= PRO_UNLOCK_AT };
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatRemainingChallenges(n: number): string {
  return `${n} ${pluralRu(n, 'челлендж', 'челленджа', 'челленджей')} до PRO`;
}
