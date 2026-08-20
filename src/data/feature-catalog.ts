import type { PlayerRole } from '@/lib/role-inference';
import type { HomeLayoutOverride, HomeCardSize } from '@/store/useHomeLayoutStore';

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
  /** Краткое описание (≤70 симв., тактический тон) — подпись под HubCard на главной. */
  description: string;
  /** Реальный ассет иконки (сверено с headerConfig/role-hubs/public/icons). */
  iconPath: string;
  /** Реальный маршрут EFT. Для ready:false клик всё равно ведёт на /eft/soon. */
  href: string;
  /** Построена ли фича. false → грид ведёт на заглушку /eft/soon. */
  ready: boolean;
  /** Крупная плитка HubCard (variant 'square', 2×2) на главной. Только у 'maps'. */
  big?: boolean;
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
  { id: 'maps', name: 'Карты локаций', description: 'Интерактивные топографические данные', iconPath: '/icons/eft/maps-icon.svg', href: '/eft/maps', ready: true, big: true },
  { id: 'questmap', name: 'Карта заданий', description: 'Интерактивный прогресс выполнения заданий', iconPath: '/icons/eft/04-progression/quest-map.svg', href: '/eft/questmap', ready: true },
  { id: 'collector', name: 'Трекер Каппы', description: 'Все предметы контейнера Kappa — отмечай собранное', iconPath: '/icons/eft/profile-pannel/kappa_icon.svg', href: '/eft/progress/collector', ready: true },
  { id: 'items', name: 'Предметы', description: 'База предметов: цены, тиры лута, характеристики', iconPath: '/icons/eft/03-items/loot-tier.svg', href: '/eft/items', ready: true },
  { id: 'story', name: 'Сюжетные', description: 'Сюжетные квесты и прохождение по шагам', iconPath: '/icons/eft/02-quests/lore-quests.svg', href: '/eft/quests/lore-quests', ready: true },
  { id: 'side', name: 'Побочные', description: 'Побочные задания торговцев', iconPath: '/icons/eft/02-quests/side-quests.svg', href: '/eft/quests/side-quests', ready: true },
  { id: 'events', name: 'События', description: 'Уникальные внутриигровые события', iconPath: '/icons/eft/02-quests/ingame-events.svg', href: '/eft/quests/events', ready: true },
  { id: 'progress', name: 'Прогресс', description: 'Твой прогресс по всем разделам портала', iconPath: '/icons/eft/progress-icon.svg', href: '/eft/progress', ready: true },
  { id: 'arcade', name: 'Аркады', description: 'Мини-игры в ожидании рейда — рекорды идут в ранг', iconPath: '/icons/eft/04-progression/eft-arcade-icon.svg', href: '/eft/progress/rookie/arcade', ready: true },
  { id: 'hideout', name: 'Убежище ЧВК', description: 'Станции убежища и порядок апгрейдов', iconPath: '/icons/eft/04-progression/hideout-modules.svg', href: '/eft/progress/hideout', ready: true },
  { id: 'craft-profit', name: 'Прибыль убежища', description: 'Крафты, что приносят профит', iconPath: '/icons/eft/04-progression/craft-profit.svg', href: '/eft/progress/hideout/craft-profit', ready: true },
  { id: 'seasons', name: 'Сезоны', description: 'Что даёт текущий сезон и как его пройти', iconPath: '/icons/eft/04-progression/seasons/seasons-icon.svg', href: '/eft/progress/seasons', ready: true },
  { id: 'battlepass', name: 'Battlepass-трекер', description: 'Прогресс наград боевого пропуска', iconPath: '/icons/eft/04-progression/seasons/battlepass-docs-tracker-icon.svg', href: '/eft/progress/seasons/tracker', ready: true },
  { id: 'loadouts', name: 'Сборки оружия', description: 'Конструктор сборок со стат-движком', iconPath: '/icons/eft/04-progression/gun-loadouts.svg', href: '/eft/progress/loadouts', ready: true },
  { id: 'needed', name: 'Важные предметы', description: 'Все предметы для заданий и убежища — сбор, схрон, докупить', iconPath: '/icons/eft/04-progression/items-needed.svg', href: '/eft/progress/needed', ready: true },
  { id: 'codex', name: 'Кодекс', description: 'Информация о мире Таркова', iconPath: '/icons/eft/codex-icon.svg', href: '/eft/gamesetting', ready: true },
  { id: 'game-updates', name: 'Обновления игры', description: 'Патчи и изменения по версиям', iconPath: '/icons/eft/05-gamesetting/game-updates.svg', href: '/eft/gamesetting/game-updates', ready: true },
  { id: 'achievements', name: 'Достижения', description: 'Все ачивки и что нужно для Каппы', iconPath: '/icons/eft/04-progression/achievments.svg', href: '/eft/progress/achievements', ready: true },
  { id: 'prestige', name: 'Престиж', description: 'Что даёт престиж и как к нему готовиться', iconPath: '/icons/eft/04-progression/prestige.svg', href: '/eft/progress/prestige', ready: true },
  { id: 'guides', name: 'Гайды', description: 'Обучающие разборы и прохождения', iconPath: '/icons/eft/06-videos/video-guides.svg', href: '/eft/videos/guides', ready: true },
  { id: 'streams', name: 'Стримы', description: 'Записи эфиров и статус трансляции', iconPath: '/icons/eft/06-videos/live-streams.svg', href: '/eft/videos/streams', ready: true },
  { id: 'advices', name: 'Советы', description: 'Короткие полезные советы по игре', iconPath: '/icons/eft/06-videos/video-advices.svg', href: '/eft/videos/advices', ready: true },
  { id: 'news', name: 'Новости', description: 'Свежак по игре без погружения', iconPath: '/icons/eft/06-videos/video-news.svg', href: '/eft/videos/news', ready: true },
  // ── Раздел «Связь» (/eft/comlink) реализован (база) → ready:true ──
  { id: 'find-partner', name: 'Поиск напарника', description: 'Найти людей под рейд', iconPath: '/icons/eft/07-comlink/find-partner.svg', href: '/eft/comlink/find-partner', ready: true },
  { id: 'candidates', name: 'Кандидаты', description: 'Кто ищет группу прямо сейчас', iconPath: '/icons/eft/07-comlink/candidates.svg', href: '/eft/comlink/candidates', ready: true },
  { id: 'sherpa-exchange', name: 'Биржа шерпов', description: 'Найти учеников и наставников', iconPath: '/icons/eft/07-comlink/sherpa.svg', href: '/eft/comlink/sherpa-exchange', ready: true },
  { id: 'discussions', name: 'Обсуждения', description: 'Комьюнити и тактики', iconPath: '/icons/eft/07-comlink/discussions.svg', href: '/eft/comlink/discussions', ready: true },
  { id: 'masterclass', name: 'Мастер-классы', description: 'Разборы и обучение от комьюнити', iconPath: '/icons/eft/07-comlink/masterclasses.svg', href: '/eft/comlink/masterclasses', ready: true },
  { id: 'blog', name: 'Блог ЦТА', description: 'Статьи и заметки редакции портала', iconPath: '/icons/eft/07-comlink/blog.svg', href: '/eft/comlink/blog', ready: true },
  { id: 'feedback', name: 'Сообщения об ошибках', description: 'Сообщить об ошибке на портале', iconPath: '/icons/eft/00-nav/comlink-icon.svg', href: '#', ready: true, action: 'feedback' },
  { id: 'flea-companion', name: 'Компаньон барахолки', description: 'Помощник по ценам и сделкам барахолки', iconPath: '/icons/eft/07-comlink/fleamarker-companion.svg', href: '/eft/companion', ready: true },
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
  collector: ['maps', 'items', 'collector', 'achievements', 'questmap', 'side', 'tracker', 'needed', 'prestige'],
  tryhard: ['maps', 'items', 'loadouts', 'streams', 'achievements', 'events', 'arcade'],
  casual: ['maps', 'items', 'arcade', 'events', 'streams', 'news', 'codex'],
};

/** Одна плитка главной после применения override: фича + итоговый размер. */
export interface HomeFeature {
  feature: PortalFeature;
  size: HomeCardSize;
}

/**
 * Вычисление показа главной (Слой 1, §4.7 — чистая функция, без стора/JSX).
 * 1. База = набор архетипа + `added` (уникально, через FEATURE_BY_ID; невалидные id и
 *    action-фичи типа feedback отфильтровываются — на главную не попадают).
 * 2. Минус `hidden`.
 * 3. Порядок: `pinned` первыми (в их порядке), затем остальное в порядке базы.
 * 4. Размер по умолчанию: `maps` → 'big', остальные → 'middle'; `sizes[id]` переопределяет.
 * Пустой override → чистая авто-база (Слой 0).
 */
export function computeHomeFeatures(role: PlayerRole, override: HomeLayoutOverride): HomeFeature[] {
  // База: набор архетипа + добавленные, уникально, порядок базы сохраняем.
  const baseIds: string[] = [];
  const seen = new Set<string>();
  for (const id of [...ARCHETYPE_FEATURES[role], ...override.added]) {
    if (seen.has(id)) continue;
    seen.add(id);
    baseIds.push(id);
  }

  const hidden = new Set(override.hidden);
  const isEligible = (id: string): boolean => {
    if (hidden.has(id)) return false;
    const f = FEATURE_BY_ID[id];
    // Невалидный id или спец-действие (feedback) — не плитка главной.
    return f !== undefined && f.action === undefined;
  };

  // Закреплённые — первыми, в порядке pinned; затем остальные в порядке базы.
  const pinned = override.pinned.filter((id) => baseIds.includes(id) && isEligible(id));
  const pinnedSet = new Set(pinned);
  const rest = baseIds.filter((id) => !pinnedSet.has(id) && isEligible(id));

  return [...pinned, ...rest].map((id) => {
    const feature = FEATURE_BY_ID[id];
    const size: HomeCardSize = override.sizes[id] ?? (feature.big ? 'big' : 'middle');
    return { feature, size };
  });
}
