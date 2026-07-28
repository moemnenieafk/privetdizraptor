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
    description: 'Единая база данных снаряжения зоны. Всё найденное, захваченное и применимое — в одном реестре.',
    iconClass: 'icon-eft-items-loot-tier',
  },
  'eft-quests': {
    title: 'Задания',
    description: 'Все сюжетные и побочные задания от торговцев. Прохождения, награды и необходимые предметы.',
    iconClass: 'icon-eft-quests',
  },
  'eft-comlink': {
    title: 'Связь',
    description: 'Сообщество ЦТА: поиск напарников, биржа шерпов, мастер-классы, новостной блог и обновления игры.',
    iconClass: 'icon-eft-comlink-icon',
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
  'eft-progress-quests': {
    title: 'Карта заданий',
    description: 'Интерактивная карта зависимостей квестов от всех торговцев. Отслеживайте прогресс, фильтруйте по Каппе и Смотрителю Маяка.',
    iconClass: 'icon-eft-prog-quest-map',
  },
  'eft-progress-tracker': {
    title: 'Трекер Предметов',
    description: 'Агрегированный вид всех предметов, нужных для активных квестов. Отмечайте найденные предметы и отслеживайте прогресс по каждому заданию.',
    iconClass: 'icon-eft-prog-items-tracker',
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
  'eft-quests-events': {
    title: 'События',
    description: 'Хронология всех внутриигровых ивентов: сюжетные главы, праздничные события, изменения боссов, экономики и механик.',
    iconClass: 'icon-eft-quests-events',
  },
  // ─── Снаряжение ───────────────────────────────────────────────────────────────
  'eft-items-gear': {
    title: 'Снаряжение',
    description: 'Защитные системы оператора. Класс брони, вместимость, штрафы к мобильности — параметры выживания.',
    iconClass: 'icon-eft-items-gear',
  },
  'eft-items-gear-headphones': {
    title: 'Наушники',
    description: 'Активные системы слухового контроля. Подавляют импульсный шум — усиливают звук шагов противника.',
    iconClass: 'icon-eft-gear-headphones',
  },
  'eft-items-gear-helmets': {
    title: 'Шлемы',
    description: 'Баллистическая защита головы. Класс, прочность, блокировка наушников — взвешивай приоритеты.',
    iconClass: 'icon-eft-gear-helmets',
  },
  'eft-items-gear-masks': {
    title: 'Маски',
    description: 'Лицевые щиты. Ограниченная баллистика, фрагментная защита. Проверь штрафы к эргономике.',
    iconClass: 'icon-eft-gear-masks',
  },
  'eft-items-gear-visors': {
    title: 'Очки и Визоры',
    description: 'Оптические системы и визоры. Баллистические линзы, ПНВ, термооптика — зрение в любых условиях.',
    iconClass: 'icon-eft-gear-visors',
  },
  'eft-items-gear-eyewear': {
    title: 'Очки и Визоры',
    description: 'Оптические системы и визоры. Баллистические линзы, ПНВ, термооптика — зрение в любых условиях.',
    iconClass: 'icon-eft-gear-visors',
  },
  'eft-items-gear-armor': {
    title: 'Бронежилеты',
    description: 'Бронезащита корпуса. Класс, тип пластины, прочность и штрафы — выбор под задачу и уровень угрозы.',
    iconClass: 'icon-eft-gear-armor',
  },
  'eft-items-gear-rigs': {
    title: 'Разгрузки',
    description: 'Тактические разгрузки. Переноска боеприпасов и снаряжения. Часть — со встроенной бронёй.',
    iconClass: 'icon-eft-gear-rigs',
  },
  'eft-items-gear-backpacks': {
    title: 'Рюкзаки',
    description: 'Системы переноски груза. Объём против штрафов к мобильности. Чем больше несёшь — тем медленнее уходишь.',
    iconClass: 'icon-eft-gear-backpacks',
  },
  'eft-items-gear-components': {
    title: 'Компоненты',
    description: 'Арморные вставки и компоненты. Определяют класс защиты в соответствующих слотах снаряжения.',
    iconClass: 'icon-eft-gear-comps',
  },
  // ─── Оружие (legacy keys) ─────────────────────────────────────────────────────
  'eft-items-guns': {
    title: 'Оружие',
    description: 'Полный арсенал огнестрельного и холодного оружия, гранат, а также огромный выбор тактических модификаций.',
    iconClass: 'icon-eft-items-guns',
  },
  'eft-items-guns-ammo': {
    title: 'Боеприпасы',
    description: 'Реестр боеприпасов. Калибры, урон, пробитие — тактический выбор под цель.',
    iconClass: 'icon-eft-guns-ammo',
  },
  'eft-items-guns-grenades': {
    title: 'Гранаты',
    description: 'Ручные гранаты. Выжигание укрытий, зачистка помещений — применяй без прямой видимости.',
    iconClass: 'icon-eft-guns-grenades',
  },
  'eft-items-guns-firearms': {
    title: 'Огнестрельное',
    description: 'Полный реестр огнестрельного оружия зоны по типам и классам.',
    iconClass: 'icon-eft-items-guns',
  },
  'eft-items-guns-firearms-gl': {
    title: 'Гранатометы',
    description: 'Тяжёлая огневая поддержка. Эффективны на открытых позициях и при зачистке укреплённых точек.',
    iconClass: 'icon-eft-guns-gl-bear',
  },
  'eft-items-guns-firearms-bolt': {
    title: 'Болтовые винтовки',
    description: 'Снайперские системы. Высокая точность на дистанции — за счёт скорости перезарядки.',
    iconClass: 'icon-eft-guns-bolt-bear',
  },
  'eft-items-guns-firearms-dmr': {
    title: 'Пехотные винтовки',
    description: 'Полуавтоматические снайперские платформы. Точность дальнего боя с боевым темпом огня.',
    iconClass: 'icon-eft-guns-dmr-bear',
  },
  'eft-items-guns-firearms-ar': {
    title: 'Штурмовые винтовки',
    description: 'Основное оружие оператора. Баланс дальности, огня и контроля — универсальные условия применения.',
    iconClass: 'icon-eft-guns-ar-bear',
  },
  'eft-items-guns-firearms-carbine': {
    title: 'Карабины',
    description: 'Укороченные боевые платформы. Маневренность в помещениях. Ниже дальность — выше скорость в CQB.',
    iconClass: 'icon-eft-guns-carbine-bear',
  },
  'eft-items-guns-firearms-lmg': {
    title: 'Пулеметы',
    description: 'Системы огневого подавления. Высокая скорострельность, большой боезапас. Контроль позиции.',
    iconClass: 'icon-eft-guns-lmg-bear',
  },
  'eft-items-guns-firearms-shotgun': {
    title: 'Дробовики',
    description: 'Доминирование в ближнем бою. Зачистка в помещениях. На открытой дистанции — неэффективны.',
    iconClass: 'icon-eft-guns-shotgun-bear',
  },
  'eft-items-guns-firearms-smg': {
    title: 'Пистолеты-Пулеметы',
    description: 'Компактные, высокая скорострельность. CQB и городская среда. Ограниченное пробитие средней брони.',
    iconClass: 'icon-eft-guns-smg-bear',
  },
  'eft-items-guns-firearms-sidearm': {
    title: 'Пистолеты',
    description: 'Вторичное вооружение. Мгновенное переключение. Последний рубеж при перезарядке основного.',
    iconClass: 'icon-eft-guns-sidearm-bear',
  },
  'eft-items-guns-mods': {
    title: 'Моды',
    description: 'Модульная система вооружения. Критические части, функциональные узлы, аксессуары.',
    iconClass: 'icon-eft-guns-mods',
  },
  'eft-items-guns-melee': {
    title: 'Холодное оружие',
    description: 'Бесшумное устранение и экстренная самооборона. Нет боеприпасов — нет задержки.',
    iconClass: 'icon-eft-guns-knifes',
  },
  'eft-items-guns-special': {
    title: 'Специальное оружие',
    description: 'Нишевые системы вооружения для специфических задач. Ограниченный тираж.',
    iconClass: 'icon-eft-guns-special',
  },
  'eft-items-guns-mods-vitalparts': {
    title: 'Критические',
    description: 'Несущие компоненты. Без них оружие не функционирует. Ствол, коробка, рукоятка — основа системы.',
    iconClass: 'icon-eft-guns-parts-vital',
  },
  'eft-items-guns-mods-functional': {
    title: 'Функциональные',
    description: 'Тактические надстройки. Дульные устройства, прицелы, ЛЦУ — боевая эффективность.',
    iconClass: 'icon-eft-guns-parts-functional',
  },
  'eft-items-guns-mods-elements': {
    title: 'Элементы',
    description: 'Конструктивные элементы. Крепления, магазины, приклады — форм-фактор и баланс.',
    iconClass: 'icon-eft-guns-parts-gearmods',
  },
  // ─── Оборудование (legacy keys) ──────────────────────────────────────────────
  'eft-items-equipment': {
    title: 'Оборудование',
    description: 'Медикаменты, инъекторы, ключи, контейнеры, провизия и прочее жизненно важное тактическое снаряжение.',
    iconClass: 'icon-eft-items-equipment',
  },
  'eft-items-equipment-meds': {
    title: 'Медикаменты',
    description: 'Медицинское обеспечение. Аптечки, инъекторы, перевязка — поддержание боеспособности под огнём.',
    iconClass: 'icon-eft-eq-meds',
  },
  'eft-items-equipment-containers': {
    title: 'Контейнеры',
    description: 'Специализированная переноска ценного груза. Кейсы и защищённые контейнеры.',
    iconClass: 'icon-eft-eq-containers',
  },
  'eft-items-equipment-containers-secure': {
    title: 'Защищенные',
    description: 'Защищённые контейнеры. Единственное, что переживает гибель оператора в рейде.',
    iconClass: 'icon-eft-eq-secure',
  },
  'eft-items-equipment-keys': {
    title: 'Ключи',
    description: 'Средства доступа к закрытым объектам. Механика и ключ-карты к комнатам с приоритетным лутом.',
    iconClass: 'icon-eft-eq-keys',
  },
  'eft-items-equipment-keys-mechanical': {
    title: 'Механические',
    description: 'Механические ключи. Доступ к комнатам с лутом на локациях. Часть — строго для заданий.',
    iconClass: 'icon-eft-eq-mechkeys',
  },
  'eft-items-equipment-keys-mechanical-marked': {
    title: 'Меченые ключи',
    description: 'Меченые ключи. Доступ к тайникам с высокоценным снаряжением. Высший приоритет при зачистке.',
    iconClass: 'icon-eft-eq-markedkeys',
  },
  'eft-items-equipment-keys-mechanical-quest': {
    title: 'Ключи для заданий',
    description: 'Квестовые ключи. Обязательны для выполнения контрактов торговцев. Запрещены к продаже.',
    iconClass: 'icon-eft-eq-questkeys',
  },
  'eft-items-equipment-provisions': {
    title: 'Провизия',
    description: 'Полевой паёк. Поддержание гидратации и энергии — обязательный расходник в длительных рейдах.',
    iconClass: 'icon-eft-eq-provisions',
  },
  'eft-items-equipment-info': {
    title: 'Инфопредметы',
    description: 'Информационные носители. Карты, схемы, флешки, документы — ресурс для специализированных контрактов.',
    iconClass: 'icon-eft-eq-infoitems',
  },
  'eft-items-equipment-special': {
    title: 'Спецоборудование',
    description: 'Специализированное тактическое снаряжение высокого приоритета. Ограниченное применение.',
    iconClass: 'icon-eft-eq-special',
  },
  'eft-items-equipment-provisions-food': {
    title: 'Еда',
    description: 'Полевые продовольственные рационы. Восполняют шкалу энергии для продолжения операции.',
    iconClass: 'icon-eft-eq-food',
  },
  'eft-items-equipment-provisions-drinks': {
    title: 'Напитки',
    description: 'Питьевые запасы. Поддержание уровня гидратации — прямая боевая необходимость.',
    iconClass: 'icon-eft-eq-drinks',
  },
  // ─── Бартер-предметы ──────────────────────────────────────────────────────────
  'eft-items-barter': {
    title: 'Предметы для Бартера',
    description: 'Обменный фонд зоны. Электроника, ценности, стройматериалы, инструменты — валюта торговых постов.',
    iconClass: 'icon-eft-prog-barter',
  },
  'eft-items-barter-others': { title: 'Другие', description: 'Прочие бартерные предметы вне стандартной классификации.', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-flammable-materials': { title: 'Г.С.М.', description: 'Горюче-смазочные материалы. Топливо, масла, химреактивы — основа промышленного бартера.', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-tools': { title: 'Инструменты', description: 'Инструменты и оборудование. Востребованы у торговцев для производственного бартера.', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-medical-supplies': { title: 'Медматериалы', description: 'Медицинское сырьё. Клей, антисептики, препараты — приоритетный товар для Терапевта.', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-building-materials': { title: 'Стройматериалы', description: 'Плиты, кабели, трубы — востребованы для крупного бартера и строительства убежища.', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-household-materials': { title: 'Хозтовары', description: 'Хозяйственные товары. Широкий спрос у большинства торговцев. Стабильный ресурс для обмена.', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-valuables': { title: 'Ценности', description: 'Ценные предметы. Высокая ликвидность — монеты, ювелирка, антиквариат. Приоритет у Скупщика.', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-electronics': { title: 'Электроника', description: 'Электронные компоненты. Универсальный ресурс. Высокий приоритет в бартерных схемах торговцев.', iconClass: 'icon-eft-prog-barter' },
  'eft-items-barter-energy-elements': { title: 'Элементы питания', description: 'Аккумуляторы, батареи, конденсаторы — энергетический ресурс зоны. Постоянный спрос.', iconClass: 'icon-eft-prog-barter' },
  // ─── Моды (верхний уровень) ───────────────────────────────────────────────────
  'eft-items-mods': {
    title: 'Моды',
    description: 'Модульная система вооружения. Критические части, функциональные узлы и аксессуары — точная настройка под тактику.',
    iconClass: 'icon-eft-guns-mods',
  },
  'eft-items-mods-vitalparts': { title: 'Критические', description: 'Несущие компоненты. Без них оружие не функционирует. Ствол, коробка, рукоятка — основа системы.', iconClass: 'icon-eft-guns-parts-vital' },
  'eft-items-mods-vitalparts-gasblocks': { title: 'Газовые трубки', description: 'Газоотводные узлы. Регулируют цикл автоматики. Критичны для надёжной работы оружия.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-vitalparts-receivers': { title: 'Крышки и ресиверы', description: 'Несущие элементы ствольной системы. Определяют базовые характеристики и посадочные места.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-vitalparts-pistolgrips': { title: 'Рукоятки', description: 'Пистолетные рукоятки. Влияют на эргономику. Определяют удобство удержания и управление оружием.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-vitalparts-barrels': { title: 'Стволы', description: 'Сменные стволы под задачу. Длина влияет на точность, скорость пули и доступные дульные устройства.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-vitalparts-handguards': { title: 'Цевья', description: 'Цевья и накладки. Меняют вес, эргономику и количество точек крепления тактических аксессуаров.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional': { title: 'Функциональные', description: 'Тактические надстройки. Дульные устройства, прицелы, ЛЦУ — боевая эффективность в любой ситуации.', iconClass: 'icon-eft-guns-parts-functional' },
  'eft-items-mods-functional-auxiliary': { title: 'Вспом. части', description: 'Вспомогательные элементы. Расширяют функционал без прямого влияния на основные характеристики.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional-muzzle': { title: 'Дульные устройства', description: 'Пламегасители, глушители, компенсаторы. Управление вспышкой и откатом на выходе ствола.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional-sights': { title: 'Прицелы', description: 'Оптические и коллиматорные прицелы. Увеличение, эргономика, прицельная дальность — под задачу.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional-laser': { title: 'Фонарики и ЛЦУ', description: 'Тактические осветительные устройства и лазерные целеуказатели. Работают в комплексе с NVG.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional-bipods': { title: 'Сошки', description: 'Опорные сошки. Стабилизация на огневой позиции. Критичны для точной работы на дальней дистанции.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-functional-foregrips': { title: 'Такт. рукоятки', description: 'Передние тактические рукоятки. Управляемость очередью. Эргономика в активном ближнем бою.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-elements': { title: 'Элементы', description: 'Конструктивные элементы платформы. Магазины, приклады, крепления — форм-фактор и баланс системы.', iconClass: 'icon-eft-guns-parts-gearmods' },
  'eft-items-mods-elements-mounts': { title: 'Крепления', description: 'Планки и переходники. Стандартизируют установку прицелов и тактических аксессуаров.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-elements-magazines': { title: 'Магазины', description: 'Магазины под калибр. Ёмкость и скорость замены — оперативный показатель в бою.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-elements-stocks': { title: 'Приклады и Ложе', description: 'Приклады и ложа. Определяют эргономику, вес и возможность складирования. Влияют на управляемость.', iconClass: 'icon-eft-guns-mods' },
  'eft-items-mods-elements-charginghandles': { title: 'Рукоятки заряжания', description: 'Рукоятки заряжания. Влияют на скорость досылания и удобство перезарядки под огнём.', iconClass: 'icon-eft-guns-mods' },
  // ─── Оружие (новая плоская структура) ────────────────────────────────────────
  'eft-items-weapons': {
    title: 'Оружие',
    description: 'Полный арсенал зоны. Штурмовые и болтовые, дробовики, пистолеты, холодное оружие — средства поражения под любую задачу.',
    iconClass: 'icon-eft-items-guns',
  },
  'eft-items-weapons-gl': { title: 'Гранатометы', description: 'Тяжёлая огневая поддержка. Работа по укреплённым позициям. Эффективны на открытых дистанциях.', iconClass: 'icon-eft-guns-gl-bear' },
  'eft-items-weapons-bolt': { title: 'Болтовые винтовки', description: 'Снайперские системы. Высокая точность на дистанции — за счёт скорости перезарядки. Каждый патрон на счету.', iconClass: 'icon-eft-guns-bolt-bear' },
  'eft-items-weapons-dmr': { title: 'Пехотные винтовки', description: 'Полуавтоматические снайперские платформы. Точность дальнего боя с боевым темпом стрельбы.', iconClass: 'icon-eft-guns-dmr-bear' },
  'eft-items-weapons-ar': { title: 'Штурмовые винтовки', description: 'Основное оружие оператора. Баланс дальности, огня и контроля — универсальные условия применения.', iconClass: 'icon-eft-guns-ar-bear' },
  'eft-items-weapons-carbine': { title: 'Карабины', description: 'Укороченные боевые платформы. Маневренность в помещениях. Ниже дальность — выше скорость в CQB.', iconClass: 'icon-eft-guns-carbine-bear' },
  'eft-items-weapons-lmg': { title: 'Пулеметы', description: 'Системы огневого подавления. Высокая скорострельность, большой боезапас. Захват и удержание позиции.', iconClass: 'icon-eft-guns-lmg-bear' },
  'eft-items-weapons-shotgun': { title: 'Дробовики', description: 'Доминирование в ближнем бою. Зачистка в помещениях. На открытой дистанции — неэффективны.', iconClass: 'icon-eft-guns-shotgun-bear' },
  'eft-items-weapons-smg': { title: 'Пистолеты-Пулеметы', description: 'Компактные, высокая скорострельность. CQB и городская среда. Ограниченное пробитие средней брони.', iconClass: 'icon-eft-guns-smg-bear' },
  'eft-items-weapons-sidearm': { title: 'Пистолеты', description: 'Вторичное вооружение. Мгновенное переключение. Последний рубеж при отказе или перезарядке основного.', iconClass: 'icon-eft-guns-sidearm-bear' },
  'eft-items-weapons-melee': { title: 'Холодное оружие', description: 'Бесшумное устранение и экстренная самооборона. Нет боеприпасов — нет задержки.', iconClass: 'icon-eft-guns-knifes' },
  'eft-items-weapons-grenades': { title: 'Гранаты', description: 'Ручные боеприпасы. Зачистка укрытий и помещений без прямого контакта. Выбор типа — под задачу.', iconClass: 'icon-eft-guns-grenades' },
  'eft-items-weapons-special': { title: 'Специальное', description: 'Специализированные системы вооружения. Нишевое применение, высокая специфика задачи.', iconClass: 'icon-eft-guns-special' },
  // ─── Боеприпасы ───────────────────────────────────────────────────────────────
  'eft-items-ammo': {
    title: 'Боеприпасы',
    description: 'Реестр боеприпасов зоны. Пробитие, урон, фрагментация — выбор патрона определяет исход боя.',
    iconClass: 'icon-eft-guns-ammo',
  },
  'eft-items-ammo-rounds': { title: 'Патроны', description: 'Одиночные патроны по калибрам. Сравнение пробития, урона, фрагментации — выбор под бронецель.', iconClass: 'icon-eft-guns-ammo' },
  'eft-items-ammo-ammo-boxes': { title: 'Пачки патронов', description: 'Заводские упаковки боеприпасов. Закупка у торговцев. Гарантированное наличие вне зависимости от барахолки.', iconClass: 'icon-eft-guns-ammo' },
  // ─── Провизия ─────────────────────────────────────────────────────────────────
  'eft-items-provisions': { title: 'Провизия', description: 'Полевой паёк. Поддержание гидратации и энергии в условиях длительных рейдов — обязательный расходник.', iconClass: 'icon-eft-eq-provisions' },
  'eft-items-provisions-food': { title: 'Еда', description: 'Полевые продовольственные рационы. Восполняют шкалу энергии для продолжения операции.', iconClass: 'icon-eft-eq-food' },
  'eft-items-provisions-drinks': { title: 'Напитки', description: 'Питьевые запасы. Поддержание уровня гидратации — прямая боевая необходимость.', iconClass: 'icon-eft-eq-drinks' },
  // ─── Медикаменты ──────────────────────────────────────────────────────────────
  'eft-items-meds': { title: 'Медикаменты', description: 'Медицинское обеспечение оператора. Аптечки, инъекторы, стимуляторы — всё для поддержания боеспособности.', iconClass: 'icon-eft-eq-meds' },
  'eft-items-meds-medkits': { title: 'Аптечки', description: 'Медицинские аптечки. Восстановление HP, лечение переломов и остановка кровотечений.', iconClass: 'icon-eft-eq-meds' },
  'eft-items-meds-injectors': { title: 'Инъекторы', description: 'Химические стимуляторы. Скорость, сила, обезболивание — часть имеют побочные эффекты. Применять расчётливо.', iconClass: 'icon-eft-eq-meds' },
  'eft-items-meds-injury': { title: 'Обработка ранений', description: 'Средства первичной помощи. Жгуты, бинты, хемостатики — остановка крови и стабилизация под огнём.', iconClass: 'icon-eft-eq-meds' },
  'eft-items-meds-pills': { title: 'Таблетки', description: 'Пероральные препараты. Долгосрочные эффекты: обезболивание, восстановление, боевая стимуляция.', iconClass: 'icon-eft-eq-meds' },
  // ─── Ключи ────────────────────────────────────────────────────────────────────
  'eft-items-keys': { title: 'Ключи', description: 'Средства доступа. Механические ключи и ключ-карты к объектам с приоритетным содержимым.', iconClass: 'icon-eft-eq-keys' },
  'eft-items-keys-mechanical': { title: 'Механические ключи', description: 'Механические ключи к комнатам на локациях. Часть — квестовые. Ограниченное число использований.', iconClass: 'icon-eft-eq-mechkeys' },
  'eft-items-keys-mechanical-marked': { title: 'Меченые ключи', description: 'Ключи с маркировкой. Доступ к тайникам с высокоценным снаряжением. Высший приоритет при зачистке.', iconClass: 'icon-eft-eq-markedkeys' },
  'eft-items-keys-mechanical-quest': { title: 'Ключи для заданий', description: 'Квестовые ключи. Обязательны для выполнения контрактов торговцев. Запрещены к продаже.', iconClass: 'icon-eft-eq-questkeys' },
  'eft-items-keys-keycards': { title: 'Ключ-карты', description: 'Магнитные ключ-карты. Лабораторные сектора и режимные зоны с максимальной ценностью лута.', iconClass: 'icon-eft-eq-keys' },
  // ─── Инфопредметы ─────────────────────────────────────────────────────────────
  'eft-items-info': { title: 'Инфопредметы', description: 'Информационные носители. Карты, схемы, накопители и документы — ресурс для специализированных контрактов.', iconClass: 'icon-eft-eq-infoitems' },
  // ─── Спецоборудование ─────────────────────────────────────────────────────────
  'eft-items-specialequipment': { title: 'Спецоборудование', description: 'Специализированное тактическое снаряжение высокого приоритета. Ограниченное применение — максимальная эффективность.', iconClass: 'icon-eft-eq-special' },
  // ─── Предметы для заданий (новый роут) ───────────────────────────────────────
  'eft-items-quest-items': { title: 'Предметы для Заданий', description: 'Квестовые реквизиты. Передача торговцам по контракту. Запрещены к продаже. Хранить отдельно.', iconClass: 'icon-eft-questitems' },
  // ─── Контейнеры (под gear) ────────────────────────────────────────────────────
  'eft-items-gear-containers': { title: 'Контейнеры', description: 'Специализированная переноска ценного груза. Кейсы для конкретных типов снаряжения.', iconClass: 'icon-eft-eq-containers' },
  'eft-items-gear-containers-cases': { title: 'Кейсы', description: 'Предметные контейнеры. Высокая плотность хранения для специфического типа груза.', iconClass: 'icon-eft-eq-containers' },
  'eft-items-gear-containers-secure': { title: 'Защищенные', description: 'Защищённые контейнеры. Единственное, что переживает гибель оператора в рейде. Абсолютный приоритет.', iconClass: 'icon-eft-eq-secure' },
};
