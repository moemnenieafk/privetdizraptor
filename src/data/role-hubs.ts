import type { PlayerRole } from '@/lib/role-inference';

// Что показывать игроку под его роль в адаптивном хабе «Ульты» (/eft/hub).
// Все href — реально существующие маршруты EFT (сверено с headerConfig).

export interface HubLink {
  /** Стабильный ключ карточки в пределах роли (React key + fallback иконки). */
  id: string;
  title: string;
  description: string;
  href: string;
  /** Явный путь к иконке (реальный ассет; иначе HubCard подставит {id}-icon.svg). */
  iconPath: string;
}

export interface RoleHub {
  intro: string;
  links: HubLink[];
  /** Подсказка при активном PvE-режиме (ось поверх роли). */
  pveHint?: string;
}

export const ROLE_HUBS: Record<PlayerRole, RoleHub> = {
  rookie: {
    intro: 'Не понимаешь Тарков? Начни отсюда — адаптируем по шагам.',
    links: [
      { id: 'rookie-path', title: 'Путь Новобранца', description: 'Интерактивный курс из 10 этапов — учим мир игры руками.', href: '/eft/progress/rookie/path', iconPath: '/icons/eft/04-progression/utarkov.svg' },
      { id: 'rookie-lore', title: 'Кодекс: история мира', description: 'Что это за место и почему все стреляют.', href: '/eft/gamesetting/lore', iconPath: '/icons/eft/05-gamesetting/tarkov-lore.svg' },
      { id: 'rookie-prapor', title: 'Первые квесты Прапора', description: 'С чего начать прогресс.', href: '/eft/quests/prapor', iconPath: '/images/traders/eft/prapor.webp' },
      { id: 'rookie-ammo', title: 'Боеприпасы', description: 'Какой патрон брать на старте.', href: '/eft/items/ammo', iconPath: '/icons/eft/03-items/guns/cat-ammo.svg' },
    ],
  },
  progressor: {
    intro: 'Гриндишь квесты? Держи всё для чистого прохождения.',
    links: [
      { id: 'progressor-questmap', title: 'Карта заданий', description: 'Граф квестов и зависимости.', href: '/eft/questmap', iconPath: '/icons/eft/04-progression/quest-map.svg' },
      { id: 'progressor-quests', title: 'Задания', description: 'Все квесты по торговцам и сюжету.', href: '/eft/quests', iconPath: '/icons/eft/quests-icon.svg' },
      { id: 'progressor-tracker', title: 'Трекер предметов', description: 'Что нужно сдать и куда.', href: '/eft/progress/tracker', iconPath: '/icons/eft/04-progression/items-tracker.svg' },
      { id: 'progressor-needed', title: 'Важные предметы', description: 'Что не выкидывать из схрона.', href: '/eft/progress/needed', iconPath: '/icons/eft/04-progression/items-needed.svg' },
    ],
  },
  trader: {
    intro: 'Живёшь барахолкой? Вот где деньги.',
    pveHint: 'В ПвЕ живой барахолки нет — профит идёт через крафты убежища и лут, а не перепродажу.',
    links: [
      { id: 'trader-craft', title: 'Прибыль убежища', description: 'Крафты, что приносят профит.', href: '/eft/progress/hideout/craft-profit', iconPath: '/icons/eft/04-progression/craft-profit.svg' },
    ],
  },
  gunsmith: {
    intro: 'Кайфуешь от сборок? Собери мету и реши Gunsmith.',
    links: [
      { id: 'gunsmith-loadouts', title: 'Сборки оружия', description: 'Конструктор со стат-движком.', href: '/eft/progress/loadouts', iconPath: '/icons/eft/04-progression/gun-loadouts.svg' },
      { id: 'gunsmith-find', title: 'Найти сборку', description: 'Решатель квестов Оружейника.', href: '/eft/progress/loadouts/find', iconPath: '/icons/eft/04-progression/gun-loadouts.svg' },
      { id: 'gunsmith-guides', title: 'Видео-гайды', description: 'Разборы и сборки от Димы.', href: '/eft/videos/guides', iconPath: '/icons/eft/06-videos/video-guides.svg' },
      { id: 'gunsmith-ammo', title: 'Боеприпасы', description: 'Пробитие и урон под ствол.', href: '/eft/items/ammo', iconPath: '/icons/eft/03-items/guns/cat-ammo.svg' },
    ],
  },
  engineer: {
    intro: 'Оптимизируешь убежище? Копи правильное.',
    links: [
      { id: 'engineer-hideout', title: 'Убежище ЧВК', description: 'Станции и порядок апгрейдов.', href: '/eft/progress/hideout', iconPath: '/icons/eft/04-progression/hideout-modules.svg' },
      { id: 'engineer-modules', title: 'Модули убежища', description: 'Что нужно под каждый уровень.', href: '/eft/progress/hideout/modules', iconPath: '/icons/eft/04-progression/hideout-modules.svg' },
      { id: 'engineer-needed', title: 'Важные предметы', description: 'Что копить под постройки.', href: '/eft/progress/needed', iconPath: '/icons/eft/04-progression/items-needed.svg' },
      { id: 'engineer-craft', title: 'Прибыль убежища', description: 'Крафты и окупаемость.', href: '/eft/progress/hideout/craft-profit', iconPath: '/icons/eft/04-progression/craft-profit.svg' },
    ],
  },
  raider: {
    intro: 'Хардкор и боссы? Данные для рейда — быстро.',
    links: [
      { id: 'raider-bosses', title: 'Боссы', description: 'Спавны, лут, характеристики.', href: '/eft/gamesetting/bosses', iconPath: '/icons/eft/05-gamesetting/bosses.svg' },
      { id: 'raider-maps', title: 'Карты', description: 'Спавны, экстракты, маркеры.', href: '/eft/maps', iconPath: '/icons/eft/maps-icon.svg' },
      { id: 'raider-loot', title: 'Лут-контейнеры', description: 'Что где лежит.', href: '/eft/loot-containers', iconPath: '/icons/eft/03-items/equipment/containers/loot-containers.svg' },
      { id: 'raider-armor', title: 'Бронежилеты', description: 'Броня под задачу.', href: '/eft/items/gear/armor', iconPath: '/icons/eft/03-items/gear/cat-armor.svg' },
    ],
  },
  viewer: {
    intro: 'Пришёл за контентом? Свежак Димы и комьюнити.',
    links: [
      { id: 'viewer-videos', title: 'Видео', description: 'Архив роликов @fullkamen.', href: '/eft/videos', iconPath: '/icons/eft/videos-icon.svg' },
      { id: 'viewer-guides', title: 'Гайды', description: 'Обучающие разборы.', href: '/eft/videos/guides', iconPath: '/icons/eft/06-videos/video-guides.svg' },
      { id: 'viewer-streams', title: 'Стримы', description: 'Записи и статус эфира.', href: '/eft/videos/streams', iconPath: '/icons/eft/06-videos/live-streams.svg' },
      { id: 'viewer-masterclasses', title: 'Мастер-классы', description: 'Разборы от шерпов комьюнити.', href: '/eft/comlink/masterclasses', iconPath: '/icons/eft/07-comlink/masterclasses.svg' },
    ],
  },
  rat: {
    intro: 'Тихий лут без лишнего боя? Держи данные, чтобы не спалиться.',
    pveHint: 'В ПвЕ давления игроков меньше — фокус смещается на чистый лут и сюжет.',
    links: [
      { id: 'rat-maps', title: 'Карты', description: 'Спавны, выходы, простреливаемые линии.', href: '/eft/maps', iconPath: '/icons/eft/maps-icon.svg' },
      { id: 'rat-loot', title: 'Лут-контейнеры', description: 'Где лежит ценное.', href: '/eft/loot-containers', iconPath: '/icons/eft/03-items/equipment/containers/loot-containers.svg' },
    ],
  },
  sherpa: {
    intro: 'Водишь и учишь новичков? Инструменты наставника здесь.',
    links: [
      { id: 'sherpa-exchange', title: 'Биржа шерпов', description: 'Найти учеников и наставников.', href: '/eft/comlink/sherpa-exchange', iconPath: '/icons/eft/07-comlink/sherpa.svg' },
      { id: 'sherpa-masterclasses', title: 'Мастер-классы', description: 'Разборы и обучение от комьюнити.', href: '/eft/comlink/masterclasses', iconPath: '/icons/eft/07-comlink/masterclasses.svg' },
      { id: 'sherpa-partner', title: 'Поиск напарника', description: 'Собрать группу под рейд.', href: '/eft/comlink/find-partner', iconPath: '/icons/eft/07-comlink/find-partner.svg' },
      { id: 'sherpa-codex', title: 'Кодекс', description: 'База знаний, чтобы объяснять на пальцах.', href: '/eft/gamesetting/lore', iconPath: '/icons/eft/05-gamesetting/tarkov-lore.svg' },
    ],
  },
  lore: {
    intro: 'Фанат вселенной? Погружайся в мир Норвинска.',
    links: [
      { id: 'lore-world', title: 'История мира', description: 'Что здесь произошло и почему.', href: '/eft/gamesetting/lore', iconPath: '/icons/eft/05-gamesetting/tarkov-lore.svg' },
      { id: 'lore-timeline', title: 'Хронология', description: 'События по датам.', href: '/eft/gamesetting/timeline', iconPath: '/icons/eft/05-gamesetting/timeline.svg' },
      { id: 'lore-characters', title: 'Персонажи', description: 'Кто есть кто в Таркове.', href: '/eft/gamesetting/characters', iconPath: '/icons/eft/05-gamesetting/characters.svg' },
      { id: 'lore-theories', title: 'Теории и загадки', description: 'Тайны и версии комьюнити.', href: '/eft/gamesetting/theories', iconPath: '/icons/eft/05-gamesetting/theory-riddles.svg' },
    ],
  },
  squad: {
    intro: 'Играешь отрядом? Собери пати и держи связь.',
    links: [
      { id: 'squad-partner', title: 'Поиск напарника', description: 'Найти людей под рейд.', href: '/eft/comlink/find-partner', iconPath: '/icons/eft/07-comlink/find-partner.svg' },
      { id: 'squad-candidates', title: 'Кандидаты', description: 'Кто ищет группу.', href: '/eft/comlink/candidates', iconPath: '/icons/eft/07-comlink/candidates.svg' },
      { id: 'squad-discussions', title: 'Обсуждения', description: 'Комьюнити и тактики.', href: '/eft/comlink/discussions', iconPath: '/icons/eft/07-comlink/discussions.svg' },
      { id: 'squad-masterclasses', title: 'Мастер-классы', description: 'Учиться играть вместе.', href: '/eft/comlink/masterclasses', iconPath: '/icons/eft/07-comlink/masterclasses.svg' },
    ],
  },
  seasonal: {
    intro: 'Гонишь сезон? Держи прогресс боевого пропуска и ивенты под рукой.',
    links: [
      { id: 'seasonal-seasons', title: 'Сезоны', description: 'Что даёт текущий сезон и как его пройти.', href: '/eft/progress/seasons', iconPath: '/icons/eft/04-progression/seasons/seasons-icon.svg' },
      { id: 'seasonal-battlepass', title: 'Battlepass-трекер', description: 'Прогресс наград боевого пропуска.', href: '/eft/progress/seasons/tracker', iconPath: '/icons/eft/04-progression/seasons/battlepass-docs-tracker-icon.svg' },
      { id: 'seasonal-events', title: 'События', description: 'Игровые ивенты и их окна.', href: '/eft/quests/events', iconPath: '/icons/eft/02-quests/ingame-events.svg' },
      { id: 'seasonal-achievements', title: 'Достижения', description: 'Сезонные и постоянные ачивки.', href: '/eft/progress/achievements', iconPath: '/icons/eft/04-progression/achievments.svg' },
    ],
  },
  collector: {
    intro: 'Идёшь на Каппу? Собери достижения и закрой квесты подчистую.',
    links: [
      { id: 'collector-achievements', title: 'Достижения', description: 'Все ачивки и что нужно для Каппы.', href: '/eft/progress/achievements', iconPath: '/icons/eft/04-progression/achievments.svg' },
      { id: 'collector-questmap', title: 'Карта заданий', description: 'Граф квестов и зависимости.', href: '/eft/questmap', iconPath: '/icons/eft/04-progression/quest-map.svg' },
      { id: 'collector-tracker', title: 'Трекер предметов', description: 'Что нужно сдать и куда.', href: '/eft/progress/tracker', iconPath: '/icons/eft/04-progression/items-tracker.svg' },
      { id: 'collector-prestige', title: 'Престиж', description: 'Что даёт и как готовиться.', href: '/eft/progress/prestige', iconPath: '/icons/eft/04-progression/prestige.svg' },
    ],
  },
  tryhard: {
    intro: 'Тащишь рейды? Мета-сборки, ачивки и свежак по бою — быстро.',
    links: [
      { id: 'tryhard-loadouts', title: 'Сборки оружия', description: 'Мета-сборки со стат-движком.', href: '/eft/progress/loadouts', iconPath: '/icons/eft/04-progression/gun-loadouts.svg' },
      { id: 'tryhard-achievements', title: 'Достижения', description: 'Боевые ачивки и K/D-вехи.', href: '/eft/progress/achievements', iconPath: '/icons/eft/04-progression/achievments.svg' },
      { id: 'tryhard-streams', title: 'Стримы', description: 'Мета из эфиров и разборов.', href: '/eft/videos/streams', iconPath: '/icons/eft/06-videos/live-streams.svg' },
      { id: 'tryhard-events', title: 'События', description: 'Ивенты с боевыми наградами.', href: '/eft/quests/events', iconPath: '/icons/eft/02-quests/ingame-events.svg' },
    ],
  },
  casual: {
    intro: 'Играешь для чилла? Лёгкий вход — аркады, ивенты и свежак.',
    links: [
      { id: 'casual-arcade', title: 'Аркады', description: 'Мини-игры между рейдами.', href: '/eft/progress/rookie/arcade', iconPath: '/icons/eft/04-progression/eft-arcade-icon.svg' },
      { id: 'casual-events', title: 'События', description: 'Что происходит в игре прямо сейчас.', href: '/eft/quests/events', iconPath: '/icons/eft/02-quests/ingame-events.svg' },
      { id: 'casual-streams', title: 'Стримы', description: 'Смотреть, пока отдыхаешь.', href: '/eft/videos/streams', iconPath: '/icons/eft/06-videos/live-streams.svg' },
      { id: 'casual-news', title: 'Новости', description: 'Свежак по игре без погружения.', href: '/eft/videos/news', iconPath: '/icons/eft/06-videos/video-news.svg' },
    ],
  },
};

/** Множество href, релевантных роли (из её кураторского хаб-набора). */
export function relevantHrefsForRole(role: PlayerRole): Set<string> {
  return new Set(ROLE_HUBS[role].links.map((l) => l.href));
}

/**
 * Переупорядочить каталог под архетип, НЕ удаляя карточки (R05): элементы, чей href
 * есть в хаб-наборе роли, идут первыми, остальные держат исходный порядок.
 * Стабильная частичная сортировка — детерминированная, порядок в данных, не в JSX (§4.7).
 */
export function orderCardsByRole<T extends { href: string }>(cards: readonly T[], role: PlayerRole): T[] {
  const relevant = relevantHrefsForRole(role);
  const primary: T[] = [];
  const rest: T[] = [];
  for (const card of cards) (relevant.has(card.href) ? primary : rest).push(card);
  return [...primary, ...rest];
}
