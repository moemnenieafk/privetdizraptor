// Доменная сборка досье игрока (§4.7 «разметка не считает»): статус оперативника,
// key-readouts hero-band, список тактических карточек-разделов, флаги earned-фич.
// Всё чистые функции — данные из сторов/сервера собирает клиент, тут только раскладка.
// NIGHTFALL: ни цвета, ни классов — только данные (иконки/href/подписи). JSX — в компоненте.

import type { PlayerProfile } from '@/store/usePlayerStore';
import type { OperatorStatus, RadarSpoke } from '@/components/features/profile';
import type { RoleAxes } from '@/lib/role-inference';
import type { PlayerStanding, StandingContribution, AccessTier } from '@/lib/player-standing';
import { unlockedBy } from '@/lib/player-standing';

/** Одна строка key-readout в hero-band. value=null → «—» + шаг «добавить профиль». */
export interface KeyReadout {
  key: string;
  label: string;
  /** null — данных нет (RollUpCounter покажет placeholder). */
  value: number | null;
  /** Формат числа (проценты/часы). По умолчанию — целое. */
  kind?: 'int' | 'percent' | 'hours';
}

/** Тактическая карточка-раздел прогресса. */
export interface SectionCard {
  id: string;
  title: string;
  description: string;
  href: string;
  /** Явный путь к иконке (реальные ассеты из headerConfig — не полагаемся на {id}-icon). */
  iconPath: string;
}

/**
 * Статус-LED оперативника из режима активного профиля. Нет профиля → offline
 * (пустое состояние: «добавь профиль»). PvE/PvP из поля mode профиля ЧВК.
 */
export function operatorStatus(profile: PlayerProfile | null): OperatorStatus {
  if (!profile) return 'offline';
  return profile.mode === 'PVE' ? 'pve' : 'pvp';
}

/**
 * Key-readouts hero-band (§3.1 п.1): уровень · рейды · выживаемость · часы. Значения —
 * из профиля ЧВК (usePlayerStore); отсутствующие (null) остаются null → каждое пустое
 * поле = call-to-action «Добавить профиль / OCR» в hero (§4.5), а не «0».
 */
export function heroReadouts(profile: PlayerProfile | null): KeyReadout[] {
  const levelNum = profile ? Number.parseInt(profile.level, 10) : NaN;
  return [
    { key: 'level', label: 'Уровень', value: Number.isFinite(levelNum) ? levelNum : null, kind: 'int' },
    { key: 'raids', label: 'Рейды', value: profile?.raids ?? null, kind: 'int' },
    { key: 'survival', label: 'Выживаемость', value: profile?.survivalRate ?? null, kind: 'percent' },
    { key: 'hours', label: 'Часы', value: profile?.hoursPlayed ?? null, kind: 'hours' },
  ];
}

/** Есть ли у профиля хоть один реальный факт (не дефолтная болванка) — для CTA hero. */
export function profileHasFacts(profile: PlayerProfile | null): boolean {
  if (!profile) return false;
  const lvl = Number.parseInt(profile.level, 10);
  return (
    (Number.isFinite(lvl) && lvl > 1) ||
    profile.raids != null ||
    profile.survivalRate != null ||
    profile.hoursPlayed != null
  );
}

/**
 * Разделы прогресса для сетки тактических карточек (§3.1 п.4). Ссылки — существующие
 * маршруты EFT (сверено с headerConfig). Порядок фиксированный: трекеры → убежище →
 * сезоны → сборки → аркада → туториал → квесты → престиж (surface прогресса, R16i).
 */
export const DOSSIER_SECTIONS: readonly SectionCard[] = [
  { id: 'tracker', title: 'Трекер предметов', description: 'Что найдено под квесты, убежище и бартеры.', href: '/eft/progress/tracker', iconPath: '/icons/eft/04-progression/items-tracker.svg' },
  { id: 'hideout', title: 'Убежище ЧВК', description: 'Модули, апгрейды и пассивные бонусы базы.', href: '/eft/progress/hideout', iconPath: '/icons/eft/04-progression/hideout-modules.svg' },
  { id: 'seasons', title: 'Сезоны и Батлпасс', description: 'Конструктор перков и трекер наград сезона.', href: '/eft/progress/seasons', iconPath: '/icons/eft/04-progression/seasons/seasons-icon.svg' },
  { id: 'loadouts', title: 'Сборки оружия', description: 'Конструктор со стат-движком и мета-сборки.', href: '/eft/progress/loadouts', iconPath: '/icons/eft/04-progression/gun-loadouts.svg' },
  { id: 'arcade', title: 'Зал автоматов', description: 'Аркады на время ожидания — рекорды идут в ранг.', href: '/eft/progress/rookie/arcade', iconPath: '/icons/eft/04-progression/utarkov.svg' },
  { id: 'rookie', title: 'Путь Новобранца', description: 'Курс из 10 этапов — осваиваем мир игры по шагам.', href: '/eft/progress/rookie/path', iconPath: '/icons/eft/04-progression/utarkov.svg' },
  { id: 'quests', title: 'Карта заданий', description: 'Граф квестов, зависимости и прогресс.', href: '/eft/questmap', iconPath: '/icons/eft/04-progression/quest-map.svg' },
  { id: 'prestige', title: 'Престиж', description: 'Сброс прогресса ради статуса и эксклюзивов.', href: '/eft/progress/prestige', iconPath: '/icons/eft/04-progression/prestige.svg' },
] as const;

/** Одна ячейка стат-грида ЧВК (левый блок досье, макет 2×4). */
export interface StatCell {
  key: string;
  /** Подпись-заголовок (uppercase-микро). */
  label: string;
  /** Класс монохром-иконки (.icon-eft-stat-*) из cta-profile. */
  iconClass: string;
  /** Значение; null — данных нет (ячейка покажет прочерк, §4.5). */
  value: number | null;
  /** Формат числа. */
  kind: 'int' | 'ratio';
}

/**
 * Стат-грид ЧВК (макет: 8 ячеек 2×4). Значения — из профиля (usePlayerStore, поля из
 * parse-profile P1) + число достижений передаётся из стора (хелпер чистый, сторов не читает).
 * СЕРИЯ ВЫЖИВАНИЙ — макетная ячейка без источника в профиле (нет поля streak): значение null →
 * прочерк, как любое незаполненное поле. K/O — единственный «ratio» (0.71), остальные — целые.
 */
export function statGrid(profile: PlayerProfile | null, achievements: number): StatCell[] {
  const survivedCount =
    profile?.survived ??
    (profile?.raids != null && profile.survivalRate != null
      ? Math.round((profile.raids * profile.survivalRate) / 100)
      : null);
  return [
    { key: 'hours', label: 'Часов', iconClass: 'icon-eft-stat-gamehours', value: profile?.hoursPlayed ?? null, kind: 'int' },
    { key: 'raids', label: 'Рейдов', iconClass: 'icon-eft-stat-raids', value: profile?.raids ?? null, kind: 'int' },
    { key: 'survived', label: 'Выживаний', iconClass: 'icon-eft-stat-survives', value: survivedCount, kind: 'int' },
    { key: 'streak', label: 'Серия выживаний', iconClass: 'icon-eft-stat-survives', value: null, kind: 'int' },
    { key: 'kd', label: 'К·О', iconClass: 'icon-eft-stat-kd', value: profile?.kd ?? null, kind: 'ratio' },
    { key: 'kills', label: 'Убийств ЧВК', iconClass: 'icon-eft-stat-pmckills', value: profile?.kills ?? null, kind: 'int' },
    { key: 'deaths', label: 'Смертей', iconClass: 'icon-eft-stat-deaths', value: profile?.deaths ?? null, kind: 'int' },
    { key: 'achievements', label: 'Достижений', iconClass: 'icon-eft-stat-achievments', value: achievements, kind: 'int' },
  ];
}

/** Процент выживаемости для кольца (макет: «52% ВЫЖИВАНИЙ»). null → пустое кольцо. */
export function survivalRingPercent(profile: PlayerProfile | null): number | null {
  return profile?.survivalRate ?? null;
}

/**
 * Значение опыта под кольцом («EXP+ 9 165 146»). У профиля нет отдельного поля XP игры —
 * оцениваем очками боевой эффективности портала (standing.total). Это НАШ опыт (участие на
 * портале), не игровой — честнее показать заработанное, чем выдумать чужое число.
 */
export function experienceValue(standing: PlayerStanding): number {
  return standing.total;
}

/**
 * 5-осевой радар эффективности (макет: БОЙ · АГРЕССИЯ · ДОБЫЧА · ВЫЖИВАНИЕ · ОТРЯД), значения
 * 0..1. Первые 4 оси — из биполярных RoleAxes ((v+1)/2). Пятой оси «ВЫЖИВАНИЕ» в RoleAxes НЕТ —
 * приближаем из pmcStats: survivalRate/100, при отсутствии — из K/D (насыщение при K/D≈3), иначе
 * нейтраль 0.5. Порядок осей задан явно, чтобы совпасть с макетом по кругу (сверху БОЙ, дальше по
 * часовой). Приближение честно вынесено в CONCERNS — сверяет V4DYA.
 */
export function radarAxes5(axes: RoleAxes | null, profile: PlayerProfile | null): RadarSpoke[] {
  const bipolar = (v: number | undefined): number => ((v ?? 0) + 1) / 2;
  const survival =
    profile?.survivalRate != null
      ? Math.max(0, Math.min(1, profile.survivalRate / 100))
      : profile?.kd != null
        ? Math.max(0, Math.min(1, profile.kd / 3))
        : 0.5;
  return [
    { label: 'Бой', value: bipolar(axes?.economyCombat) },
    { label: 'Агрессия', value: bipolar(axes?.cautionAggression) },
    { label: 'Добыча', value: bipolar(axes?.sprintCollect) },
    { label: 'Выживание', value: survival },
    { label: 'Отряд', value: bipolar(axes?.soloClan) },
  ];
}

/**
 * ЗАРАБОТАННЫЕ вклады боевой эффективности для макетной панели (XP-ТИР · ДОСТИЖЕНИЯ · ПУТЬ
 * НОВОБРАНЦА · АРКАДА). Карма (Связь/Компаньон) — ОТДЕЛЬНЫЙ блок «КАРМА» на макете (серверная
 * репутация), поэтому исключается отсюда: боевая эффективность = заработанное на портале.
 */
const EARNED_KEYS = new Set(['xp', 'achievements', 'tutorial', 'arcade']);
export function earnedContributions(standing: PlayerStanding): StandingContribution[] {
  return standing.contributions.filter((c) => EARNED_KEYS.has(c.key));
}

/** Earned/paid-фичи досье и их доступность (R08). Витрина, не security — см. player-standing. */
export interface DossierUnlocks {
  /** Вкладка истории standing — ЗАРАБОТАННАЯ рангом (плата НЕ байпасит). */
  standingHistory: boolean;
  /** Детальный радар — ЗАРАБОТАННЫЙ рангом. */
  detailedRadar: boolean;
}

/**
 * Что открыто в досье при данном standing и тире. Earned-фичи гейтятся ТОЛЬКО рангом
 * (interfaces.md, нота ревью R08) — тир сюда не влияет, но прокидываем его для полноты
 * сигнатуры unlockedBy (paid-фичи считаются отдельно, здесь только earned-вкладки).
 */
export function dossierUnlocks(standing: PlayerStanding, tier: AccessTier): DossierUnlocks {
  return {
    standingHistory: unlockedBy(standing, tier, 'standing-history'),
    detailedRadar: unlockedBy(standing, tier, 'detailed-radar'),
  };
}
