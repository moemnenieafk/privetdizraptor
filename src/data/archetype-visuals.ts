import type { PlayerRole } from '@/lib/role-inference';

// Визуал архетипа-«класса» для бейджа/жетона: иконка (.icon-mask) + семантический акцент +
// короткий тег. ИМЕНА ролей НЕ дублируем — берём из ROLE_LABELS (role-inference.ts).
//
// accent — ССЫЛКА НА ТОКЕН (var(--color-…)), не сырой HEX (NIGHTFALL §6). Применяется через
// color-mix для свечения/подложки бейджа и НЕ подменяет глобальный --primary (только акцент
// самого бейджа). iconClass — путь к монохромному SVG для CSS-маски (.icon-mask), workflow §7.1.

export interface ArchetypeVisual {
  /** Путь к монохромной SVG-иконке для .icon-mask (перекрашивается через bg-*). */
  iconClass: string;
  /** Семантический акцент бейджа — CSS-переменная токена (var(--color-…)). */
  accent: string;
  /** Короткий тег-класс (uppercase, для микро-подписи бейджа). */
  tag: string;
}

// Акценты выбраны из существующих токенов globals.css (не заводим новых цветов):
//   trader/engineer → изумруд (lightkeeper) · raider → красный (danger) ·
//   rat → серый (text-muted) · gunsmith → янтарь (tactical-amber) ·
//   sherpa/squad → голубой (edition-tue / mode-pve) · progressor → success ·
//   viewer → twitch · lore → kappa · rookie → нейтральный muted.
// Расширенные архетипы (4) — свои неповторяющиеся токены:
//   seasonal → золото (edition-eod) · collector → фиолет (rarity-rare-badge) ·
//   tryhard → красный-failure (отличен от danger рейдера) · casual → бирюза (accent-frago).
// ⚠️ iconClass у 4 расширенных — ЗАГЛУШКИ (тематически близкая существующая иконка);
//   V4DYA дорисует свои. См. CONCERNS в отчёте.
export const ARCHETYPE_VISUALS: Record<PlayerRole, ArchetypeVisual> = {
  rookie: {
    iconClass: '/icons/eft/00-nav/codex.svg',
    accent: 'var(--color-text-secondary)',
    tag: 'REC',
  },
  progressor: {
    iconClass: '/icons/eft/00-nav/quests-icon.svg',
    accent: 'var(--color-success)',
    tag: 'OPS',
  },
  trader: {
    iconClass: '/icons/eft/03-items/currency-ruble.svg',
    accent: 'var(--color-lightkeeper)',
    tag: 'ECON',
  },
  gunsmith: {
    iconClass: '/icons/eft/02-quests/quest-modify.svg',
    accent: 'var(--color-tactical-amber)',
    tag: 'TECH',
  },
  engineer: {
    iconClass: '/icons/eft/00-nav/progress-icon.svg',
    accent: 'var(--color-nvg-green)',
    tag: 'ENG',
  },
  raider: {
    iconClass: '/icons/eft/02-quests/quest-eliminate.svg',
    accent: 'var(--color-danger)',
    tag: 'CQB',
  },
  viewer: {
    iconClass: '/icons/eft/00-nav/videos-icon.svg',
    accent: 'var(--color-twitch)',
    tag: 'MEDIA',
  },
  rat: {
    iconClass: '/icons/eft/02-quests/quest-loot.svg',
    accent: 'var(--color-text-muted)',
    tag: 'SCAV',
  },
  sherpa: {
    iconClass: '/icons/eft/00-nav/comlink-icon.svg',
    accent: 'var(--color-edition-tue)',
    tag: 'MENTOR',
  },
  lore: {
    iconClass: '/icons/eft/02-quests/lore-quests.svg',
    accent: 'var(--color-kappa)',
    tag: 'INTEL',
  },
  squad: {
    iconClass: '/icons/eft/02-quests/quest-trader-reputation.svg',
    accent: 'var(--color-mode-pve)',
    tag: 'FIRETEAM',
  },
  // ── Расширенные архетипы: iconClass — ЗАГЛУШКИ (V4DYA дорисует) ──
  seasonal: {
    iconClass: '/icons/eft/04-progression/seasons/seasons-icon.svg', // заглушка
    accent: 'var(--color-edition-eod)',
    tag: 'SEASON',
  },
  collector: {
    iconClass: '/icons/eft/04-progression/achievments.svg', // заглушка
    accent: 'var(--color-rarity-rare-badge)',
    tag: 'KAPPA',
  },
  tryhard: {
    iconClass: '/icons/eft/04-progression/gun-loadouts.svg', // заглушка
    accent: 'var(--color-failure)',
    tag: 'CARRY',
  },
  casual: {
    iconClass: '/icons/eft/04-progression/eft-arcade-icon.svg', // заглушка
    accent: 'var(--color-accent-frago)',
    tag: 'CHILL',
  },
};
