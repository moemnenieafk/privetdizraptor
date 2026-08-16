// Доменная сборка досье игрока (§4.7 «разметка не считает»): статус оперативника,
// key-readouts hero-band, список тактических карточек-разделов, флаги earned-фич.
// Всё чистые функции — данные из сторов/сервера собирает клиент, тут только раскладка.
// NIGHTFALL: ни цвета, ни классов — только данные (иконки/href/подписи). JSX — в компоненте.

import type { PlayerProfile } from '@/store/usePlayerStore';
import type { OperatorStatus } from '@/components/features/profile';
import type { PlayerStanding, AccessTier } from '@/lib/player-standing';
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
