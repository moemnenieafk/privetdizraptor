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
  'eft-items-loot-rate': {
    title: 'Рейтинг предметов',
    description: 'Актуальный рейтинг ценности лута. Узнайте, какие предметы стоит выносить из рейда в первую очередь для максимальной выгоды.',
    iconClass: 'icon-eft-items-loot-tier',
  },
  'eft-items-gear': {
    title: 'Снаряжение',
    description: 'Обзор всей доступной экипировки: бронежилеты, шлемы, разгрузки и рюкзаки для защиты и выживания в рейде.',
    iconClass: 'icon-eft-items-gear',
  },
  'eft-items-gear-headphones': {
    title: 'Наушники',
    description: '',
    iconClass: 'icon-eft-gear-headphones',
  },
  'eft-items-gear-helmets': {
    title: 'Шлемы',
    description: '',
    iconClass: 'icon-eft-gear-helmets',
  },
  'eft-items-gear-masks': {
    title: 'Маски',
    description: '',
    iconClass: 'icon-eft-gear-masks',
  },
  'eft-items-gear-visors': {
    title: 'Очки и Визоры',
    description: '',
    iconClass: 'icon-eft-gear-visors',
  },
  'eft-items-gear-armor': {
    title: 'Бронежилеты',
    description: '',
    iconClass: 'icon-eft-gear-armor',
  },
  'eft-items-gear-rigs': {
    title: 'Разгрузки',
    description: '',
    iconClass: 'icon-eft-gear-rigs',
  },
  'eft-items-gear-backpacks': {
    title: 'Рюкзаки',
    description: '',
    iconClass: 'icon-eft-gear-backpacks',
  },  
  'eft-items-gear-components': {
    title: 'Компоненты',
    description: '',
    iconClass: 'icon-eft-gear-comps',
  },
  'eft-items-guns': {
    title: 'Оружие',
    description: 'Полный арсенал огнестрельного и холодного оружия, гранат, а также огромный выбор тактических модификаций.',
    iconClass: 'icon-eft-items-guns',
  },
  'eft-items-guns-ammo': {
    title: 'Боеприпасы',
    description: '',
    iconClass: 'icon-eft-guns-ammo',
  },
  'eft-items-guns-grenades': {
    title: 'Гранаты',
    description: '',
    iconClass: 'icon-eft-guns-grenades',
  },
  'eft-items-guns-firearms': {
    title: 'Огнестрельное',
    description: '',
    iconClass: 'icon-eft-items-guns',
  },
  'eft-items-guns-firearms-gl': {
    title: 'Гранатометы',
    description: '',
    iconClass: 'icon-eft-guns-gl-bear',
  },
  'eft-items-guns-firearms-bolt': {
    title: 'Болтовые винтовки',
    description: '',
    iconClass: 'icon-eft-guns-bolt-bear',
  },
  'eft-items-guns-firearms-dmr': {
    title: 'Пехотные винтовки',
    description: '',
    iconClass: 'icon-eft-guns-dmr-bear',
  },
  'eft-items-guns-firearms-ar': {
    title: 'Штурмовые винтовки',
    description: '',
    iconClass: 'icon-eft-guns-ar-bear',
  },
  'eft-items-guns-firearms-carbine': {
    title: 'Карабины',
    description: '',
    iconClass: 'icon-eft-guns-carbine-bear',
  },
  'eft-items-guns-firearms-lmg': {
    title: 'Пулеметы',
    description: '',
    iconClass: 'icon-eft-guns-lmg-bear',
  },
  'eft-items-guns-firearms-shotgun': {
    title: 'Дробовики',
    description: '',
    iconClass: 'icon-eft-guns-shotgun-bear',
  },
  'eft-items-guns-firearms-smg': {
    title: 'Пистолеты-Пулеметы',
    description: '',
    iconClass: 'icon-eft-guns-smg-bear',
  },
  'eft-items-guns-firearms-sidearm': {
    title: 'Пистолеты',
    description: '',
    iconClass: 'icon-eft-guns-sidearm-bear',
  },
  'eft-items-guns-mods': {
    title: 'Моды',
    description: '',
    iconClass: 'icon-eft-guns-mods',
  },
  'eft-items-guns-melee': {
    title: 'Холодное оружие',
    description: '',
    iconClass: 'icon-eft-guns-knifes',
  },
  'eft-items-guns-special': {
    title: 'Специальное оружие',
    description: '',
    iconClass: 'icon-eft-guns-special',
  },  
  'eft-items-guns-mods-vitalparts': {
    title: 'Критические',
    description: '',
    iconClass: 'icon-eft-guns-parts-vital',
  },
  'eft-items-guns-mods-functional': {
    title: 'Функциональные',
    description: '',
    iconClass: 'icon-eft-guns-parts-functional',
  },
  'eft-items-guns-mods-elements': {
    title: 'Элементы',
    description: '',
    iconClass: 'icon-eft-guns-parts-gearmods',
  },
  'eft-items-equipment': {
    title: 'Оборудование',
    description: 'Медикаменты, инъекторы, ключи, контейнеры, провизия и прочее жизненно важное тактическое снаряжение.',
    iconClass: 'icon-eft-items-equipment',
  },
  'eft-items-equipment-meds': {
    title: 'Медикаменты',
    description: '',
    iconClass: 'icon-eft-eq-meds',
  },
  'eft-items-equipment-containers': {
    title: 'Контейнеры',
    description: '',
    iconClass: 'icon-eft-eq-containers',
  },
  'eft-items-equipment-containers-secure': {
    title: 'Защищенные',
    description: '',
    iconClass: 'icon-eft-eq-secure',
  },
  'eft-items-equipment-keys': {
    title: 'Ключи',
    description: '',
    iconClass: 'icon-eft-eq-keys',
  },
  'eft-items-equipment-keys-mechanical': {
    title: 'Механические',
    description: '',
    iconClass: 'icon-eft-eq-mechkeys',
  },
  'eft-items-equipment-keys-mechanical-marked': {
    title: 'Меченые ключи',
    description: '',
    iconClass: 'icon-eft-eq-markedkeys',
  },
  'eft-items-equipment-keys-mechanical-quest': {
    title: 'Ключи для заданий',
    description: '',
    iconClass: 'icon-eft-eq-questkeys',
  },
  'eft-items-equipment-provisions': {
    title: 'Провизия',
    description: '',
    iconClass: 'icon-eft-eq-provisions',
  },
  'eft-items-equipment-info':{
    title: 'Инфопредметы',
    description: '',
    iconClass: 'icon-eft-eq-infoitems',
  },
  'eft-items-equipment-special': {
    title: 'Спецоборудование',
    description: '',
    iconClass: 'icon-eft-eq-special',
  },
  'eft-items-equipment-provisions-food': {
    title: 'Еда',
    description: '',
    iconClass: 'icon-eft-eq-food',
  },
  'eft-items-equipment-provisions-drinks': {
    title: 'Напитки',
    description: '',
    iconClass: 'icon-eft-eq-drinks',
  },
  'eft-items-price-slot': {
    title: 'Цена за слот',
    description: 'Инструмент для оценки прибыльности предметов. Узнайте, что выгоднее всего класть в рюкзак во время рейда.',
    iconClass: 'icon-eft-items-price-slot',
  },
  // Бартер-предметы
  'eft-items-barter': {
    title: 'Предметы для Бартера',
    description: 'Полная база бартерных предметов: ценности, электроника, инструменты и прочие материалы для обмена у торговцев.',
    iconClass: 'icon-eft-prog-barter',
  },
  'eft-items-barter-others': { title: 'Другие', description: '', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-flammable-materials': { title: 'Г.С.М.', description: '', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-tools': { title: 'Инструменты', description: '', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-medical-supplies': { title: 'Медматериалы', description: '', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-building-materials': { title: 'Стройматериалы', description: '', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-household-materials': { title: 'Хозтовары', description: '', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-valuables': { title: 'Ценности', description: '', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-electronics': { title: 'Электроника', description: '', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-energy-elements': { title: 'Элементы питания', description: '', iconClass: 'icon-eft-prog-barter' },
  // Моды (верхний уровень)
  'eft-items-mods': {
    title: 'Моды',
    description: 'Все модификации для оружия: критические компоненты, функциональные элементы и вспомогательные части.',
    iconClass: 'icon-eft-guns-mods',
  },
  'eft-items-mods-vitalparts': { title: 'Критические', description: '', iconClass: 'icon-eft-guns-parts-vital' },
  'eft-items-mods-vitalparts-gasblocks': { title: 'Газовые трубки', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-vitalparts-receivers': { title: 'Крышки и ресиверы', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-vitalparts-pistolgrips': { title: 'Рукоятки', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-vitalparts-barrels': { title: 'Стволы', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-vitalparts-handguards': { title: 'Цевья', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional': { title: 'Функциональные', description: '', iconClass: 'icon-eft-guns-parts-functional' },
  'eft-items-mods-functional-auxiliary': { title: 'Вспом. части', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional-muzzle': { title: 'Дульные устройства', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional-sights': { title: 'Прицелы', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional-laser': { title: 'Фонарики и ЛЦУ', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional-bipods': { title: 'Сошки', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional-foregrips': { title: 'Такт. рукоятки', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-elements': { title: 'Элементы', description: '', iconClass: 'icon-eft-guns-parts-gearmods' },
  'eft-items-mods-elements-mounts': { title: 'Крепления', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-elements-magazines': { title: 'Магазины', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-elements-stocks': { title: 'Приклады и Ложе', description: '', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-elements-charginghandles': { title: 'Рукоятки заряжания', description: '', iconClass: 'icon-eft-guns-mods' },
  // Оружие (новая плоская структура)
  'eft-items-weapons': {
    title: 'Оружие',
    description: 'Полный арсенал: штурмовые и болтовые винтовки, дробовики, пистолеты, холодное оружие, гранаты и специальное снаряжение.',
    iconClass: 'icon-eft-items-guns',
  },
  'eft-items-weapons-gl': { title: 'Гранатометы', description: '', iconClass: 'icon-eft-guns-gl-bear' },
  'eft-items-weapons-bolt': { title: 'Болтовые винтовки', description: '', iconClass: 'icon-eft-guns-bolt-bear' },
  'eft-items-weapons-dmr': { title: 'Пехотные винтовки', description: '', iconClass: 'icon-eft-guns-dmr-bear' },
  'eft-items-weapons-ar': { title: 'Штурмовые винтовки', description: '', iconClass: 'icon-eft-guns-ar-bear' },
  'eft-items-weapons-carbine': { title: 'Карабины', description: '', iconClass: 'icon-eft-guns-carbine-bear' },
  'eft-items-weapons-lmg': { title: 'Пулеметы', description: '', iconClass: 'icon-eft-guns-lmg-bear' },
  'eft-items-weapons-shotgun': { title: 'Дробовики', description: '', iconClass: 'icon-eft-guns-shotgun-bear' },
  'eft-items-weapons-smg': { title: 'Пистолеты-Пулеметы', description: '', iconClass: 'icon-eft-guns-smg-bear' },
  'eft-items-weapons-sidearm': { title: 'Пистолеты', description: '', iconClass: 'icon-eft-guns-sidearm-bear' },
  'eft-items-weapons-melee': { title: 'Холодное оружие', description: '', iconClass: 'icon-eft-guns-knifes' },
  'eft-items-weapons-grenades': { title: 'Гранаты', description: '', iconClass: 'icon-eft-guns-grenades' },
  'eft-items-weapons-special': { title: 'Специальное', description: '', iconClass: 'icon-eft-guns-special' },
  // Боеприпасы
  'eft-items-ammo': {
    title: 'Боеприпасы',
    description: 'Подробная таблица калибров, урона, пробития и баллистических характеристик всех патронов.',
    iconClass: 'icon-eft-guns-ammo',
  },
  'eft-items-ammo-rounds': { title: 'Патроны', description: '', iconClass: 'icon-eft-guns-ammo' },
  'eft-items-ammo-ammo-boxes': { title: 'Пачки патронов', description: '', iconClass: 'icon-eft-guns-ammo' },
  // Провизия
  'eft-items-provisions': { title: 'Провизия', description: 'Еда и напитки для поддержания боеспособности в рейде.', iconClass: 'icon-eft-eq-provisions' },
  'eft-items-provisions-food': { title: 'Еда', description: '', iconClass: 'icon-eft-eq-food' },
  'eft-items-provisions-drinks': { title: 'Напитки', description: '', iconClass: 'icon-eft-eq-drinks' },
  // Медикаменты
  'eft-items-meds': { title: 'Медикаменты', description: 'Аптечки, инъекторы, средства обработки ранений и таблетки для лечения в рейде.', iconClass: 'icon-eft-eq-meds' },
  'eft-items-meds-medkits': { title: 'Аптечки', description: '', iconClass: 'icon-eft-eq-meds' },
  'eft-items-meds-injectors': { title: 'Инъекторы', description: '', iconClass: 'icon-eft-eq-meds' },
  'eft-items-meds-injury': { title: 'Обработка ранений', description: '', iconClass: 'icon-eft-eq-meds' },
  'eft-items-meds-pills': { title: 'Таблетки', description: '', iconClass: 'icon-eft-eq-meds' },
  // Ключи
  'eft-items-keys': { title: 'Ключи', description: 'Механические ключи и ключ-карты для доступа к закрытым локациям и ценному луту.', iconClass: 'icon-eft-eq-keys' },
  'eft-items-keys-mechanical': { title: 'Механические ключи', description: '', iconClass: 'icon-eft-eq-mechkeys' },
  'eft-items-keys-mechanical-marked': { title: 'Меченые ключи', description: '', iconClass: 'icon-eft-eq-markedkeys' },
  'eft-items-keys-mechanical-quest': { title: 'Ключи для заданий', description: '', iconClass: 'icon-eft-eq-questkeys' },
  'eft-items-keys-keycards': { title: 'Ключ-карты', description: '', iconClass: 'icon-eft-eq-keys' },
  // Инфо предметы
  'eft-items-info': { title: 'Инфо предметы', description: 'Карты, записки, документы и прочие информационные предметы.', iconClass: 'icon-eft-eq-infoitems' },
  // Спецоборудование
  'eft-items-specialequipment': { title: 'Спецоборудование', description: 'Специализированное тактическое снаряжение для особых задач.', iconClass: 'icon-eft-eq-special' },
  // Контейнеры (перенесены под gear)
  'eft-items-gear-containers': { title: 'Контейнеры', description: '', iconClass: 'icon-eft-eq-containers' },
  'eft-items-gear-containers-cases': { title: 'Кейсы', description: '', iconClass: 'icon-eft-eq-containers' },
  'eft-items-gear-containers-secure': { title: 'Защищенные', description: '', iconClass: 'icon-eft-eq-secure' },
};