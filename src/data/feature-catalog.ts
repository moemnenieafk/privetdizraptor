import type { PlayerRole } from '@/lib/role-inference';

// Каталог фич портала для грида «Избранные разделы архетипа» в Досье (/eft/hub).
// Источник правды раскладки — docs/decisions/archetype-feature-map.md (31 фича, порядок из макета).
// §4.7: доменная логика (какие фичи у архетипа, порядок) живёт здесь, не в JSX.
// §4.9: href ведёт на нашу страницу портала, не на внешнюю вики/маркет.

/** Одна фича портала: иконка + маршрут + флаг готовности (не готова → клик на «скоро»). */
export interface PortalFeature {
  /** Стабильный строковый ключ (React key + связка в ARCHETYPE_FEATURES). */
  id: string;
  /** RU-название (из спеки). */
  name: string;
  /** Реальный ассет иконки (сверено с headerConfig/role-hubs/public/icons). */
  iconPath: string;
  /** Реальный маршрут EFT. Для ready:false клик всё равно ведёт на /eft/soon. */
  href: string;
  /** Построена ли фича. false → грид ведёт на заглушку /eft/soon. */
  ready: boolean;
  /** Спец-действие вместо навигации: 'feedback' — открыть глобальную модалку «Сообщить об ошибке». */
  action?: 'feedback';
}

/**
 * 31 фича, порядок 1..31 = порядок из макета (значим — грид и список рендерят в нём).
 * Маршруты и иконки — реальные (headerConfig.ts, role-hubs.ts, public/icons). Раздел «Связь»
 * (/eft/comlink) реализован (база) → его фичи ready:true. Не построен только «Компаньон
 * барахолки» (ready:false) → клик из грида ведёт на /eft/soon (см. ArchetypeFeatureGrid).
 */
export const FEATURE_CATALOG: readonly PortalFeature[] = [
  { id: 'maps', name: 'Карты локаций', iconPath: '/icons/eft/maps-icon.svg', href: '/eft/maps', ready: true },
  { id: 'questmap', name: 'Карта заданий', iconPath: '/icons/eft/04-progression/quest-map.svg', href: '/eft/questmap', ready: true },
  { id: 'items', name: 'Предметы', iconPath: '/icons/eft/03-items/loot-tier.svg', href: '/eft/items', ready: true },
  { id: 'story', name: 'Сюжетные', iconPath: '/icons/eft/02-quests/lore-quests.svg', href: '/eft/quests/lore-quests', ready: true },
  { id: 'side', name: 'Побочные', iconPath: '/icons/eft/02-quests/side-quests.svg', href: '/eft/quests/side-quests', ready: true },
  { id: 'events', name: 'События', iconPath: '/icons/eft/02-quests/ingame-events.svg', href: '/eft/quests/events', ready: true },
  { id: 'progress', name: 'Прогресс', iconPath: '/icons/eft/progress-icon.svg', href: '/eft/progress', ready: true },
  { id: 'arcade', name: 'Аркады', iconPath: '/icons/eft/04-progression/eft-arcade-icon.svg', href: '/eft/progress/rookie/arcade', ready: true },
  { id: 'hideout', name: 'Убежище ЧВК', iconPath: '/icons/eft/04-progression/hideout-modules.svg', href: '/eft/progress/hideout', ready: true },
  { id: 'craft-profit', name: 'Прибыль убежища', iconPath: '/icons/eft/04-progression/craft-profit.svg', href: '/eft/progress/hideout/craft-profit', ready: true },
  { id: 'seasons', name: 'Сезоны', iconPath: '/icons/eft/04-progression/seasons/seasons-icon.svg', href: '/eft/progress/seasons', ready: true },
  { id: 'battlepass', name: 'Battlepass-трекер', iconPath: '/icons/eft/04-progression/seasons/battlepass-docs-tracker-icon.svg', href: '/eft/progress/seasons/tracker', ready: true },
  { id: 'loadouts', name: 'Сборки оружия', iconPath: '/icons/eft/04-progression/gun-loadouts.svg', href: '/eft/progress/loadouts', ready: true },
  { id: 'tracker', name: 'Трекер предметов', iconPath: '/icons/eft/04-progression/items-tracker.svg', href: '/eft/progress/tracker', ready: true },
  { id: 'needed', name: 'Важные предметы', iconPath: '/icons/eft/04-progression/items-needed.svg', href: '/eft/progress/needed', ready: true },
  { id: 'codex', name: 'Кодекс', iconPath: '/icons/eft/codex-icon.svg', href: '/eft/gamesetting', ready: true },
  { id: 'game-updates', name: 'Обновления игры', iconPath: '/icons/eft/05-gamesetting/game-updates.svg', href: '/eft/gamesetting/game-updates', ready: true },
  { id: 'achievements', name: 'Достижения', iconPath: '/icons/eft/04-progression/achievments.svg', href: '/eft/progress/achievements', ready: true },
  { id: 'prestige', name: 'Престиж', iconPath: '/icons/eft/04-progression/prestige.svg', href: '/eft/progress/prestige', ready: true },
  { id: 'guides', name: 'Гайды', iconPath: '/icons/eft/06-videos/video-guides.svg', href: '/eft/videos/guides', ready: true },
  { id: 'streams', name: 'Стримы', iconPath: '/icons/eft/06-videos/live-streams.svg', href: '/eft/videos/streams', ready: true },
  { id: 'advices', name: 'Советы', iconPath: '/icons/eft/06-videos/video-advices.svg', href: '/eft/videos/advices', ready: true },
  { id: 'news', name: 'Новости', iconPath: '/icons/eft/06-videos/video-news.svg', href: '/eft/videos/news', ready: true },
  // ── Раздел «Связь» (/eft/comlink) реализован (база) → ready:true ──
  { id: 'find-partner', name: 'Поиск напарника', iconPath: '/icons/eft/07-comlink/find-partner.svg', href: '/eft/comlink/find-partner', ready: true },
  { id: 'candidates', name: 'Кандидаты', iconPath: '/icons/eft/07-comlink/candidates.svg', href: '/eft/comlink/candidates', ready: true },
  { id: 'sherpa-exchange', name: 'Биржа шерпов', iconPath: '/icons/eft/07-comlink/sherpa.svg', href: '/eft/comlink/sherpa-exchange', ready: true },
  { id: 'discussions', name: 'Обсуждения', iconPath: '/icons/eft/07-comlink/discussions.svg', href: '/eft/comlink/discussions', ready: true },
  { id: 'masterclass', name: 'Мастер-классы', iconPath: '/icons/eft/07-comlink/masterclasses.svg', href: '/eft/comlink/masterclasses', ready: true },
  { id: 'blog', name: 'Блог ЦТА', iconPath: '/icons/eft/07-comlink/blog.svg', href: '/eft/comlink/blog', ready: true },
  { id: 'feedback', name: 'Сообщения об ошибках', iconPath: '/icons/eft/00-nav/comlink-icon.svg', href: '#', ready: true, action: 'feedback' },
  { id: 'flea-companion', name: 'Компаньон барахолки', iconPath: '/icons/eft/07-comlink/fleamarker-companion.svg', href: '/eft/companion', ready: true },
] as const;

/** Быстрый доступ к фиче по id (грид собирает набор архетипа в порядке каталога). */
export const FEATURE_BY_ID: Record<string, PortalFeature> = Object.fromEntries(
  FEATURE_CATALOG.map((f) => [f.id, f]),
);

/**
 * Избранные фичи каждого архетипа (id, порядок значим — из таблицы спеки).
 * Порядок здесь НЕ равен порядку каталога: он задаёт приоритет для будущей персонализации;
 * грид же рендерит в порядке FEATURE_CATALOG, а подсветку берёт из принадлежности этому набору.
 */
export const ARCHETYPE_FEATURES: Record<PlayerRole, readonly string[]> = {
  rookie: ['maps', 'items', 'arcade', 'codex', 'story', 'guides', 'progress'],
  progressor: ['maps', 'items', 'questmap', 'story', 'side', 'tracker', 'needed', 'arcade'],
  trader: ['maps', 'items', 'craft-profit', 'flea-companion', 'hideout', 'needed', 'arcade'],
  gunsmith: ['maps', 'items', 'loadouts', 'guides', 'advices', 'achievements', 'arcade'],
  engineer: ['maps', 'items', 'hideout', 'craft-profit', 'needed', 'tracker', 'arcade'],
  raider: ['maps', 'items', 'questmap', 'side', 'events', 'seasons', 'achievements', 'needed', 'streams', 'news', 'advices', 'arcade'],
  viewer: ['maps', 'items', 'guides', 'streams', 'advices', 'news', 'blog', 'discussions', 'masterclass', 'arcade'],
  rat: ['maps', 'items', 'needed', 'hideout', 'tracker', 'flea-companion', 'arcade'],
  sherpa: ['maps', 'items', 'codex', 'guides', 'advices', 'masterclass', 'sherpa-exchange', 'find-partner', 'discussions'],
  lore: ['maps', 'items', 'codex', 'story', 'events', 'game-updates', 'news', 'blog'],
  squad: ['maps', 'items', 'find-partner', 'candidates', 'discussions', 'streams', 'events', 'arcade'],
  seasonal: ['maps', 'items', 'seasons', 'battlepass', 'events', 'achievements', 'progress', 'arcade'],
  collector: ['maps', 'items', 'achievements', 'questmap', 'side', 'tracker', 'needed', 'prestige'],
  tryhard: ['maps', 'items', 'loadouts', 'streams', 'achievements', 'events', 'arcade'],
  casual: ['maps', 'items', 'arcade', 'events', 'streams', 'news', 'codex'],
};
