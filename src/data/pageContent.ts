export interface PageContent {
  title: string;
  description: string;
  iconClass: string;
}

export const PAGE_CONTENT_DICTIONARY: Record<string, PageContent> = {
  'eft': {
    title: 'Escape from Tarkov',
    description: 'Выберите нужный раздел для получения актуальной информации.',
    iconClass: 'icon-eft-lore-tarkov',
  },
  'eft-items': {
    title: 'Предметы',
    description: 'Полная база данных всех предметов в Escape from Tarkov, включая снаряжение, оружие, медицину и ключи.',
    iconClass: 'icon-eft-items-loot-tier',
  },
  'eft-quests': {
    title: 'Задания',
    description: 'Все сюжетные и побочные задания от торговцев. Прохождения, награды и необходимые предметы.',
    iconClass: 'icon-eft-quests',
  },
  'eft-progress': {
    title: 'Прогресс',
    description: 'Отслеживайте свой прогресс: достижения, бартеры, сборки оружия и предметы для убежища.',
    iconClass: 'icon-eft-progress',
  },
  'eft-progress-achievements': {
    title: 'Достижения',
    description: 'Список всех внутриигровых достижений с условиями их получения и наградами.',
    iconClass: 'icon-eft-prog-achievements',
  },
  'eft-progress-barter': {
    title: 'Прибыль бартера',
    description: 'Анализ самых выгодных бартерных обменов у торговцев для максимизации вашей прибыли.',
    iconClass: 'icon-eft-prog-barter',
  },
  'eft-progress-hideout': {
    title: 'Убежище ЧВК',
    description: 'Все о модулях убежища: стоимость постройки, требования, крафты и бонусы.',
    iconClass: 'icon-eft-prog-hideout',
  },
  'eft-progress-hideout-modules': {
    title: 'Модули убежища',
    description: 'Подробная информация по каждому модулю убежища, их уровням и требованиям для постройки.',
    iconClass: 'icon-eft-prog-hideout',
  },
  'eft-progress-loadouts': {
    title: 'Сборки оружия',
    description: 'Коллекция лучших сборок оружия для разных стилей игры и бюджетов. Создавайте и делитесь своими.',
    iconClass: 'icon-eft-prog-gun-loadouts',
  },
  'eft-gamesetting': {
    title: 'Кодекс',
    description: 'Погрузитесь в историю мира Escape from Tarkov. Хронология, персонажи, фракции и загадки.',
    iconClass: 'icon-eft-lore-tarkov',
  },
  'eft-videos': {
    title: 'Видео',
    description: 'Подборка полезных видео: гайды, советы, новости и лучшие моменты от сообщества.',
    iconClass: 'icon-eft-videos',
  },
  'eft-maps': {
    title: 'Карты',
    description: 'Исследуйте локации, визуализируйте спавны предметов, квесты и выходы для успешных рейдов.',
    iconClass: 'icon-eft-maps',
  },
  'eft-ammo': {
    title: 'Боеприпасы',
    description: 'Подробная таблица калибров, урона, пробития и баллистических характеристик всех патронов.',
    iconClass: 'icon-eft-guns-ammo',
  },
  'eft-crafts': {
    title: 'Крафты',
    description: 'Рецепты создания предметов в модулях убежища, их время крафта и оценка рентабельности.',
    iconClass: 'icon-eft-prog-craft',
  },
  'eft-questmap': {
    title: 'Карта заданий',
    description: 'Интерактивный инструмент для построения маршрутов и отслеживания квестов на всех локациях.',
    iconClass: 'icon-eft-prog-quest-map',
  },
  'eft-quests-lore-quests': {
    title: 'Сюжетные задания',
    description: 'Основные квестовые линии, раскрывающие историю Таркова и лор корпорации TerraGroup.',
    iconClass: 'icon-eft-quests-lore',
  },
  'eft-quests-side-quests': {
    title: 'Побочные задания',
    description: 'Дополнительные поручения и контракты от торговцев, необходимые для прокачки репутации.',
    iconClass: 'icon-eft-quests-side',
  },
};