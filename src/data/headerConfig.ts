export interface MenuItem {
  id: string;
  label: string;
  menuTitle?: string;
  /** Описание для карточки HubCard на индексе раздела и подзаголовка HubNav. */
  description?: string;
  path?: string;
  iconUrl?: string;
  iconUrlBear?: string;
  iconUrlUsec?: string;
  iconClass?: string;
  coloredIcon?: boolean;
  children?: MenuItem[];
  subItems?: MenuItem[];
}

export interface HeaderConfig {
  searchPlaceholder: string;
  menuItems: MenuItem[];
  currencySymbol: string;
  breadcrumbNames?: Record<string, string>;
}

export const HEADER_DICTIONARY: Record<string, HeaderConfig> = {
  eft: {
    searchPlaceholder: 'ГЛОБАЛЬНЫЙ ТАКТИЧЕСКИЙ ПОИСК...',
    breadcrumbNames: {
      eft: 'EFT',
      legal: 'Правовые документы',
      terms: 'Условия использования',
      privacy: 'Политика конфиденциальности',
      offer: 'Оферта',
      eula: 'Пользовательское соглашение',
      comlink: 'Связь',
      'find-partner': 'Поиск напарника',
      candidates: 'Кандидаты',
      'sherpa-exchange': 'Биржа шерпов',
      masterclasses: 'Мастер-классы',
      blog: 'Новостной блог',
      'game-updates': 'Обновления игры',
      headphones: 'Наушники',
      helmets: 'Шлемы',
      masks: 'Маски',
      visors: 'Очки и Визоры',
      eyewear: 'Очки и Визоры',
      armor: 'Бронежилеты',
      rigs: 'Разгрузки',
      backpacks: 'Рюкзаки',
      components: 'Компоненты',
      lab: 'ЛАБОРАТОРИЯ',
      'groundzero-map': 'ЭПИЦЕНТР',
      streets: 'УЛИЦЫ ТАРКОВА',
      interchange: 'РАЗВЯЗКА',
      customs: 'ТАМОЖНЯ',
      factory: 'ЗАВОД',
      woods: 'ЛЕС',
      reserve: 'РЕЗЕРВ',
      lighthouse: 'МАЯК',
      shoreline: 'БЕРЕГ',
      terminal: 'ТЕРМИНАЛ',
      labyrinth: 'ЛАБИРИНТ',
      'icebreaker-map': 'ЛЕДОКОЛ',
      'end-of-line-map': 'КОНЕЦ ПУТИ',
      'openworld-map': 'ОБЩАЯ КАРТА',
      'transits-map': 'ПЕРЕХОДЫ',
      tour: 'Тур',
      'falling-skies': 'Небеса в огне',
      ticket: 'Билет',
      batya: 'Батя',
      'the-unheard': 'Неизвестные',
      'blue-fire': 'Синий Огонь',
      'they-are-already-here': 'Они уже здесь',
      'accidental-witness': 'Случайный свидетель',
      'the-labyrinth': 'Лабиринт',
      boreas: 'Борей',
      'ingame-events': 'События',
      'prapor-quest': 'Прапор',
      'therapist-quest': 'Терапевт',
      'fence-quest': 'Скупщик',
      'skier-quest': 'Лыжник',
      'peacekeeper-quest': 'Миротворец',
      'mechanic-quest': 'Механик',
      'ragman-quest': 'Барахольщик',
      'jaeger-quest': 'Егерь',
      'ref-quest': 'Реф',
      'lightkeeper-quest': 'Смотритель Маяка',
      questmap: 'Карта Заданий',
      hub: 'Досье игрока',
      rookie: 'Аркады',
      path: 'Путь Новобранца',
      arcade: 'Зал автоматов',
      progress: 'Прогресс',
      seasons: 'Сезоны',
      perks: 'Конструктор перков',
      achievements: 'Достижения',
      styleguide: 'Styleguide',
      // Боссы (слаги /eft/gamesetting/bosses/<slug>; 1:1 nameRu из src/data/bosses.ts)
      killa: 'Килла',
      tagilla: 'Тагилла',
      shturman: 'Штурман',
      gluhar: 'Глухарь',
      sanitar: 'Санитар',
      kaban: 'Кабан',
      kollontai: 'Коллонтай',
      partisan: 'Партизан',
      zryachiy: 'Зрячий',
      bigpipe: 'Биг Пайп',
      birdeye: 'Бёрдай',
      knight: 'Найт',
      sektant: 'Жрец сектантов',
      thewedge: 'Клин',
      shadowoftagilla: 'Тень Тагиллы',
      tracker: 'Трекер предметов',
      needed: 'Важные предметы',
      'side-quests': 'Побочные',
      'lore-quests': 'Сюжетные',
      items: 'Предметы',
      gear: 'Снаряжение',
      guns: 'Оружие',
      firearms: 'Огнестрельное',
      mods: 'Моды',
      vitalparts: 'Критические',
      functional: 'Функциональные',
      elements: 'Элементы',
      equipment: 'Оборудование',
      meds: 'Медикаменты',
      containers: 'Контейнеры',
      keys: 'Ключи',
      provisions: 'Провизия',
      maps: 'Карты',
      quests: 'Задания',
      ammo: 'Боеприпасы',
      grenades: 'Гранаты',
      melee: 'Холодное',
      special: 'Специальное',
      crafts: 'Крафты',
      barter: 'Предметы для Бартера',
      'quest-items': 'Предметы для Заданий',
      barters: 'Бартеры',
      weapons: 'Оружие',
      hideout: 'Убежище ЧВК',
      gamesetting: 'Кодекс',
      lore: 'История мира',
      videos: 'Видео',
      modules: 'Модули убежища',
      loadouts: 'Сборки оружия',
      gasblocks: 'Газовые трубки',
      receivers: 'Крышки и ресиверы',
      pistolgrips: 'Рукоятки',
      barrels: 'Стволы',
      handguards: 'Цевья',
      auxiliary: 'Вспом. части',
      muzzle: 'Дульные устройства',
      sights: 'Прицелы',
      laser: 'Фонарики и ЛЦУ',
      bipods: 'Сошки',
      foregrips: 'Такт. рукоятки',
      mounts: 'Крепления',
      magazines: 'Магазины',
      stocks: 'Приклады и Ложе',
      charginghandles: 'Рукоятки заряжания',
      launchers: 'Подствольные устройства',
      medkits: 'Аптечки',
      injectors: 'Инъекторы',
      injury: 'Обработка ранений',
      pills: 'Таблетки',
      infoitems: 'Инфопредметы',
      mechanical: 'Механические ключи',
      keycards: 'Ключ-карты',
      cases: 'Кейсы',
      secure: 'Защищенные',
      food: 'Еда',
      drinks: 'Напитки',
      'battle-pass': 'Предметы для Батлпасса — Сезон 1',
      specialequipment: 'Спецоборудование',
      valuables: 'Ценности',
      electronics: 'Электроника',
      tools: 'Инструменты',
      'flammable-materials': 'Горюче-смазочные материалы',
      marked: 'Меченые Ключи',
      'quest-keys': 'Ключ для Заданий',
      gl: 'Гранатометы',
      bolt: 'Болтовые винтовки',
      dmr: 'Пехотные винтовки',
      ar: 'Штурмовые винтовки',
      carbine: 'Карабины',
      lmg: 'Пулеметы',
      shotgun: 'Дробовики',
      smg: 'Пистолеты-Пулеметы',
      sidearm: 'Пистолеты',
      'pistol-grips': 'Пистолетные рукоятки',
      'defective-wall': 'Аварийная стена',
      security: 'Безопасность',
      'bitcoin-farm': 'Биткоин Ферма',
      vents: 'Вентиляция',
      workbench: 'Верстак',
      prestige: 'Престиж',
      groundzero: 'ЭПИЦЕНТР',
      'ground-zero': 'ЭПИЦЕНТР',
      'streets-of-tarkov': 'УЛИЦЫ ТАРКОВА',
      icebreaker: 'ЛЕДОКОЛ',
      'end-of-line': 'КОНЕЦ ПУТИ',
      quest: 'Ключи для Заданий',
      info: 'Инфопредметы',
      prapor: 'Прапор',
      therapist: 'Терапевт',
      fence: 'Скупщик',
      skier: 'Лыжник',
      peacekeeper: 'Миротворец',
      mechanic: 'Механик',
      ragman: 'Барахольщик',
      jaeger: 'Егерь',
      ref: 'Реф',
      lightkeeper: 'Смотритель Маяка',
      'btr-driver': 'Водитель БТР',
      events: 'События',
      'heaven-on-fire': 'Небеса в огне',
      unknowns: 'Неизвестные',
      'already-here': 'Они уже здесь',
      witness: 'Случайный свидетель',   
      'craft-profit': 'Прибыль убежища',
      'bitcoin-profit': 'Прибыль Bitcoin',
      'building-materials': 'Стройматериалы',
      'household-materials': 'Хозтовары',
      'medical-supplies': 'Медматериалы',
      'energy-elements': 'Элементы Питания',
      others: 'Другие',
      rounds: 'Патроны',
      'ammo-boxes': 'Пачки патронов',
      my: 'Мои сборки',
      find: 'Найти сборку',
      add: 'Создать сборку',
      timeline: 'Хронология',
      characters: 'Персонажи',
      bosses: 'Боссы',
      traders: 'Торговцы',
      factions: 'Фракции',
      corporations: 'Корпорации',
      locations: 'Локации',
      materials: 'Материалы',
      audiotapes: 'Аудиозаписи',
      'docs-notes': 'Документы и записки',
      theories: 'Теории и загадки',
      guides: 'Гайды',
      advices: 'Советы',
      news: 'Новости',
      streams: 'Стримы',
    },
    menuItems: [
      // ВЕТКА 1: КАРТЫ (Полностью структурированная)
      { 
        id: 'maps', 
        label: 'Карты', 
        iconUrl: '/icons/eft/maps-icon.svg',
        path: '/eft/maps',
        children: [
          { id: 'lab', label: 'ЛАБОРАТОРИЯ', iconUrl: '/icons/eft/01-maps/lab-map-icon.svg', path: '/eft/maps/the-lab' },
          { id: 'groundzero', label: 'ЭПИЦЕНТР', iconUrl: '/icons/eft/01-maps/groundzero-map-icon.svg', path: '/eft/maps/ground-zero' },
          { id: 'streets', label: 'УЛИЦЫ ТАРКОВА', iconUrl: '/icons/eft/01-maps/streets-map-icon.svg', path: '/eft/maps/streets-of-tarkov' },
          { id: 'interchange', label: 'РАЗВЯЗКА', iconUrl: '/icons/eft/01-maps/interchange-map-icon.svg', path: '/eft/maps/interchange' },
          { id: 'customs', label: 'ТАМОЖНЯ', iconUrl: '/icons/eft/01-maps/customs-map-icon.svg', path: '/eft/maps/customs' },
          { id: 'factory', label: 'ЗАВОД', iconUrl: '/icons/eft/01-maps/factory-map-icon.svg', path: '/eft/maps/factory' },
          { id: 'woods', label: 'ЛЕС', iconUrl: '/icons/eft/01-maps/woods-map-icon.svg', path: '/eft/maps/woods' },
          { id: 'reserve', label: 'РЕЗЕРВ', iconUrl: '/icons/eft/01-maps/reserve-map-icon.svg', path: '/eft/maps/reserve' },
          { id: 'lighthouse', label: 'МАЯК', iconUrl: '/icons/eft/01-maps/lighthouse-map-icon.svg', path: '/eft/maps/lighthouse' },
          { id: 'shoreline', label: 'БЕРЕГ', iconUrl: '/icons/eft/01-maps/shoreline-map-icon.svg', path: '/eft/maps/shoreline' },
          { id: 'terminal', label: 'ТЕРМИНАЛ', iconUrl: '/icons/eft/01-maps/terminal-map-icon.svg', path: '/eft/maps/terminal' },
          { id: 'labyrinth', label: 'ЛАБИРИНТ', iconUrl: '/icons/eft/01-maps/labyrinth-map-icon.svg', path: '/eft/maps/labyrinth' },
          { id: 'icebreaker', label: 'ЛЕДОКОЛ', iconUrl: '/icons/eft/01-maps/icebreaker-map-icon.svg', path: '/eft/maps/icebreaker' },
          { id: 'end-of-line', label: 'КОНЕЦ ПУТИ', iconUrl: '/icons/eft/01-maps/end-of-line-map-icon.svg', path: '/eft/maps/end-of-line' }
          // { id: 'openworld', label: 'ОБЩАЯ КАРТА', iconUrl: '/icons/eft/01-maps/openworld-map-icon.svg', path: '/eft/maps/openworld' },
          // { id: 'transits', label: 'ПЕРЕХОДЫ', iconUrl: '/icons/eft/01-maps/transits-map-icon.svg', path: '/eft/maps/transits' }
        ]
      },
      // Остальные ветки (пока плоские заглушки, ждут данных)
      {
        id: 'quests',
        label: 'Задания',
        path: '/eft/quests',
        iconUrl: '/icons/eft/quests-icon.svg',
        children: [
          {
            id: 'story-quests',
            label: 'Сюжетные',
            path: '/eft/quests/lore-quests',
            iconUrl: '/icons/eft/02-quests/lore-quests.svg',
            children: [
              { id: 'q-tour', label: 'Тур', path: '/eft/quests/tour', iconUrl: '/icons/eft/02-quests/story-tour.svg' },
              { id: 'q-heaven', label: 'Небеса в огне', path: '/eft/quests/heaven-on-fire', iconUrl: '/icons/eft/02-quests/story-falling-skies.svg' },
              { id: 'q-ticket', label: 'Билет', path: '/eft/quests/ticket', iconUrl: '/icons/eft/02-quests/story-the-ticket.svg' },
              { id: 'q-batya', label: 'Батя', path: '/eft/quests/batya', iconUrl: '/icons/eft/02-quests/story-batya.svg' },
              { id: 'q-unknowns', label: 'Неизвестные', path: '/eft/quests/unknowns', iconUrl: '/icons/eft/02-quests/story-the-unheard.svg' },
              { id: 'q-blue-fire', label: 'Синий Огонь', path: '/eft/quests/blue-fire', iconUrl: '/icons/eft/02-quests/story-blue-fire.svg' },
              { id: 'q-already-here', label: 'Они уже здесь', path: '/eft/quests/already-here', iconUrl: '/icons/eft/02-quests/story-they-are-already-here.svg' },
              { id: 'q-witness', label: 'Случайный свидетель', path: '/eft/quests/witness', iconUrl: '/icons/eft/02-quests/story-accidental-witness.svg' },
              { id: 'q-labyrinth', label: 'Лабиринт', path: '/eft/quests/labyrinth', iconUrl: '/icons/eft/02-quests/story-the-labyrinth.svg' },
              { id: 'q-boreas', label: 'Борей', path: '/eft/quests/boreas', iconUrl: '/icons/eft/02-quests/story-boreas.svg' }
            ]
          },
          {
            id: 'side-quests',
            label: 'Побочные',
            path: '/eft/quests/side-quests',
            iconUrl: '/icons/eft/02-quests/side-quests.svg',
            children: [
              { id: 's-prapor', label: 'Прапор', path: '/eft/quests/prapor', iconUrl: '/images/traders/eft/prapor.webp' },
              { id: 's-therapist', label: 'Терапевт', path: '/eft/quests/therapist', iconUrl: '/images/traders/eft/therapist.webp' },
              { id: 's-fence', label: 'Скупщик', path: '/eft/quests/fence', iconUrl: '/images/traders/eft/fence.webp' },
              { id: 's-skier', label: 'Лыжник', path: '/eft/quests/skier', iconUrl: '/images/traders/eft/skier.webp' },
              { id: 's-peacekeeper', label: 'Миротворец', path: '/eft/quests/peacekeeper', iconUrl: '/images/traders/eft/peacekeeper.webp' },
              { id: 's-mechanic', label: 'Механик', path: '/eft/quests/mechanic', iconUrl: '/images/traders/eft/mechanic.webp' },
              { id: 's-ragman', label: 'Барахольщик', path: '/eft/quests/ragman', iconUrl: '/images/traders/eft/ragman.webp' },
              { id: 's-jaeger', label: 'Егерь', path: '/eft/quests/jaeger', iconUrl: '/images/traders/eft/jaeger.webp' },
              { id: 's-ref', label: 'Реф', path: '/eft/quests/ref', iconUrl: '/images/traders/eft/ref.webp' },
              { id: 's-lightkeeper', label: 'Смотритель Маяка', path: '/eft/quests/lightkeeper', iconUrl: '/images/traders/eft/lightkeeper.webp' },
              { id: 's-btr', label: 'Водитель БТР', path: '/eft/quests/btr-driver', iconUrl: '/images/traders/eft/btrdriver.webp' }
            ]
          },
          {
            id: 'events',
            label: 'События',
            path: '/eft/quests/events',
            iconUrl: '/icons/eft/02-quests/ingame-events.svg'
          },
          {
            id: 'quest-map',
            label: 'Карта заданий',
            path: '/eft/questmap',
            iconUrl: '/icons/eft/04-progression/quest-map.svg'
          }
        ]
      },
      {
        id: 'items',
        label: 'Предметы',
        path: '/eft/items',
        iconUrl: '/icons/eft/03-items/loot-tier.svg',
        children: [
          // 0. БОЕВОЙ ПРОПУСК — СЕЗОН 1 (сезонная категория, синхрон со слоем карты)
          {
            id: 'i-battlepass-s1',
            label: 'BATTLEPASS - S1',
            menuTitle: 'BATTLEPASS - S1',
            path: '/eft/items/battle-pass',
            iconUrl: '/icons/eft/04-progression/seasons/seasons-icon.svg',
          },
          // 1. БАРТЕР
          {
            id: 'i-barter',
            label: 'Предметы для Бартера',
            menuTitle: 'Для Бартера',
            path: '/eft/items/barter',
            iconUrl: '/icons/eft/04-progression/barter-profit.svg',
            children: [
              { id: 'i-barter-others', label: 'Другие', path: '/eft/items/barter/others', iconUrl: '/icons/eft/04-progression/barter-profit/others.svg' },
              { id: 'i-barter-flammable', label: 'Г.С.М.', path: '/eft/items/barter/flammable-materials', iconUrl: '/icons/eft/04-progression/barter-profit/flammable-materials.svg' },
              { id: 'i-barter-tools', label: 'Инструменты', path: '/eft/items/barter/tools', iconUrl: '/icons/eft/04-progression/barter-profit/tools.svg' },
              { id: 'i-barter-medical', label: 'Медматериалы', path: '/eft/items/barter/medical-supplies', iconUrl: '/icons/eft/04-progression/barter-profit/medical-supplies.svg' },
              { id: 'i-barter-building', label: 'Стройматериалы', path: '/eft/items/barter/building-materials', iconUrl: '/icons/eft/04-progression/barter-profit/building-materials.svg' },
              { id: 'i-barter-household', label: 'Хозтовары', path: '/eft/items/barter/household-materials', iconUrl: '/icons/eft/04-progression/barter-profit/household-materials.svg' },
              { id: 'i-barter-valuables', label: 'Ценности', path: '/eft/items/barter/valuables', iconUrl: '/icons/eft/04-progression/barter-profit/valuables.svg' },
              { id: 'i-barter-electronics', label: 'Электроника', path: '/eft/items/barter/electronics', iconUrl: '/icons/eft/04-progression/barter-profit/electronics.svg' },
              { id: 'i-barter-energy', label: 'Элементы питания', path: '/eft/items/barter/energy-elements', iconUrl: '/icons/eft/04-progression/barter-profit/energy-elements.svg' },
            ]
          },
          // 2. СНАРЯЖЕНИЕ
          {
            id: 'i-gear',
            label: 'Снаряжение',
            path: '/eft/items/gear',
            iconUrl: '/icons/eft/03-items/gear.svg',
            children: [
              { id: 'i-gear-headphones', label: 'Наушники', path: '/eft/items/gear/headphones', iconUrl: '/icons/eft/03-items/gear/cat-headphones.svg' },
              { id: 'i-gear-helmets', label: 'Шлемы', path: '/eft/items/gear/helmets', iconUrl: '/icons/eft/03-items/gear/cat-helmets.svg' },
              { id: 'i-gear-masks', label: 'Маски', path: '/eft/items/gear/masks', iconUrl: '/icons/eft/03-items/gear/cat-masks.svg' },
              { id: 'i-gear-eyewear', label: 'Очки и Визоры', path: '/eft/items/gear/eyewear', iconUrl: '/icons/eft/03-items/gear/cat-visors.svg' },
              { id: 'i-gear-armor', label: 'Бронежилеты', path: '/eft/items/gear/armor', iconUrl: '/icons/eft/03-items/gear/cat-armor.svg' },
              { id: 'i-gear-rigs', label: 'Разгрузки', path: '/eft/items/gear/rigs', iconUrl: '/icons/eft/03-items/gear/cat-tactical-rigs.svg' },
              { id: 'i-gear-backpacks', label: 'Рюкзаки', path: '/eft/items/gear/backpacks', iconUrl: '/icons/eft/03-items/gear/cat-backpacks.svg' },
              {
                id: 'i-gear-containers',
                label: 'Контейнеры',
                path: '/eft/items/gear/containers',
                iconUrl: '/icons/eft/03-items/equipment/containers.svg',
                children: [
                  { id: 'i-cont-cases', label: 'Кейсы', path: '/eft/items/gear/containers/cases', iconUrl: '/icons/eft/03-items/equipment/containers/cases.svg' },
                  { id: 'i-cont-secure', label: 'Защищенные', path: '/eft/items/gear/containers/secure', iconUrl: '/icons/eft/03-items/equipment/containers/secure-containers.svg' },
                  { id: 'i-loot-containers', label: 'Лут-контейнеры', path: '/eft/loot-containers', iconUrl: '/icons/eft/03-items/equipment/containers/loot-containers.svg' }
                ]
              },
              { id: 'i-gear-components', label: 'Компоненты', path: '/eft/items/gear/components', iconUrl: '/icons/eft/03-items/gear/cat-gearcomps.svg' }
            ]
          },
          // 3. МОДЫ
          {
            id: 'i-mods',
            label: 'Моды',
            path: '/eft/items/mods',
            iconUrl: '/icons/eft/03-items/guns/cat-gunmods.svg',
            children: [
              {
                id: 'i-mods-vitalparts',
                label: 'Критические',
                path: '/eft/items/mods/vitalparts',
                iconUrl: '/icons/eft/03-items/guns/gun-modes/vital-parts.svg',
                children: [
                  { id: 'i-mods-crit-gasblocks', label: 'Газовые трубки', path: '/eft/items/mods/vitalparts/gasblocks', iconUrl: '/icons/eft/03-items/guns/gun-modes/gas-blocks.svg' },
                  { id: 'i-mods-crit-receivers', label: 'Крышки и ресиверы', path: '/eft/items/mods/vitalparts/receivers', iconUrl: '/icons/eft/03-items/guns/gun-modes/receivers-slides.svg' },
                  { id: 'i-mods-crit-pistolgrips', label: 'Рукоятки', path: '/eft/items/mods/vitalparts/pistolgrips', iconUrl: '/icons/eft/03-items/guns/gun-modes/pistol-grips.svg' },
                  { id: 'i-mods-crit-barrels', label: 'Стволы', path: '/eft/items/mods/vitalparts/barrels', iconUrl: '/icons/eft/03-items/guns/gun-modes/barrels.svg' },
                  { id: 'i-mods-crit-handguards', label: 'Цевья', path: '/eft/items/mods/vitalparts/handguards', iconUrl: '/icons/eft/03-items/guns/gun-modes/handguards.svg' }
                ]
              },
              {
                id: 'i-mods-functional',
                label: 'Функциональные',
                path: '/eft/items/mods/functional',
                iconUrl: '/icons/eft/03-items/guns/gun-modes/functional-mods.svg',
                children: [
                  { id: 'i-mods-func-aux', label: 'Вспом. части', path: '/eft/items/mods/functional/auxiliary', iconUrl: '/icons/eft/03-items/guns/gun-modes/auxiliary-parts.svg' },
                  { id: 'i-mods-func-muzzle', label: 'Дульные устройства', path: '/eft/items/mods/functional/muzzle', iconUrl: '/icons/eft/03-items/guns/gun-modes/muzzle-devices.svg' },
                  { id: 'i-mods-func-sights', label: 'Прицелы', path: '/eft/items/mods/functional/sights', iconUrl: '/icons/eft/03-items/guns/gun-modes/sights.svg' },
                  { id: 'i-mods-func-laser', label: 'Фонарики и ЛЦУ', path: '/eft/items/mods/functional/laser', iconUrl: '/icons/eft/03-items/guns/gun-modes/light-laser-device.svg' },
                  { id: 'i-mods-func-bipods', label: 'Сошки', path: '/eft/items/mods/functional/bipods', iconUrl: '/icons/eft/03-items/guns/gun-modes/bipods.svg' },
                  { id: 'i-mods-func-foregrips', label: 'Такт. рукоятки', path: '/eft/items/mods/functional/foregrips', iconUrl: '/icons/eft/03-items/guns/gun-modes/foregrips.svg' }
                ]
              },
              {
                id: 'i-mods-elements',
                label: 'Элементы',
                path: '/eft/items/mods/elements',
                iconUrl: '/icons/eft/03-items/guns/gun-modes/gear-mods.svg',
                children: [
                  { id: 'i-mods-elem-mounts', label: 'Крепления', path: '/eft/items/mods/elements/mounts', iconUrl: '/icons/eft/03-items/guns/gun-modes/mounts.svg' },
                  { id: 'i-mods-elem-magazines', label: 'Магазины', path: '/eft/items/mods/elements/magazines', iconUrl: '/icons/eft/03-items/guns/gun-modes/magazines.svg' },
                  { id: 'i-mods-elem-stocks', label: 'Приклады и Ложе', path: '/eft/items/mods/elements/stocks', iconUrl: '/icons/eft/03-items/guns/gun-modes/stocks-chassis.svg' },
                  { id: 'i-mods-elem-handles', label: 'Рукоятки заряжания', path: '/eft/items/mods/elements/charginghandles', iconUrl: '/icons/eft/03-items/guns/gun-modes/charging-handles.svg' },
                  { id: 'i-mods-elem-launchers', label: 'Подствольные устройства', path: '/eft/items/mods/elements/launchers', iconUrl: '/icons/eft/03-items/guns/gun-modes/underbarrel-launchers.svg', iconClass: 'icon-eft-underbarrel-launchers' }
                ]
              }
            ]
          },
          // 4. ОРУЖИЕ (плоская структура)
          {
            id: 'i-weapons',
            label: 'Оружие',
            path: '/eft/items/weapons',
            iconUrl: '/icons/eft/03-items/guns.svg',
            children: [
              { id: 'i-weapons-gl', label: 'Гранатометы', path: '/eft/items/weapons/gl', iconUrlBear: '/icons/eft/03-items/guns/gun-types/gl-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/gl-usec.svg' },
              { id: 'i-weapons-bolt', label: 'Болтовые винтовки', path: '/eft/items/weapons/bolt', iconUrlBear: '/icons/eft/03-items/guns/gun-types/bolt-action-riffle-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/bolt-action-riffle-usec.svg' },
              { id: 'i-weapons-dmr', label: 'Пехотные винтовки', path: '/eft/items/weapons/dmr', iconUrlBear: '/icons/eft/03-items/guns/gun-types/dmr-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/dmr-usec.svg' },
              { id: 'i-weapons-ar', label: 'Штурмовые винтовки', path: '/eft/items/weapons/ar', iconUrlBear: '/icons/eft/03-items/guns/gun-types/ar-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/ar-usec.svg' },
              { id: 'i-weapons-carbine', label: 'Карабины', path: '/eft/items/weapons/carbine', iconUrlBear: '/icons/eft/03-items/guns/gun-types/carbine-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/carbine-usec.svg' },
              { id: 'i-weapons-lmg', label: 'Пулеметы', path: '/eft/items/weapons/lmg', iconUrlBear: '/icons/eft/03-items/guns/gun-types/lmg-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/lmg-usec.svg' },
              { id: 'i-weapons-shotgun', label: 'Дробовики', path: '/eft/items/weapons/shotgun', iconUrlBear: '/icons/eft/03-items/guns/gun-types/shotgun-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/shotgun-usec.svg' },
              { id: 'i-weapons-smg', label: 'Пистолеты-Пулеметы', path: '/eft/items/weapons/smg', iconUrlBear: '/icons/eft/03-items/guns/gun-types/smg-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/smg_usec.svg' },
              { id: 'i-weapons-sidearm', label: 'Пистолеты', path: '/eft/items/weapons/sidearm', iconUrlBear: '/icons/eft/03-items/guns/gun-types/sidearm-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/sidearm-usec.svg' },
              { id: 'i-weapons-melee', label: 'Холодное оружие', path: '/eft/items/weapons/melee', iconUrl: '/icons/eft/03-items/guns/cat-knifes.svg' },
              { id: 'i-weapons-grenades', label: 'Гранаты', path: '/eft/items/weapons/grenades', iconUrl: '/icons/eft/03-items/guns/cat-grenades.svg' },
              { id: 'i-weapons-special', label: 'Специальное', path: '/eft/items/weapons/special', iconUrl: '/icons/eft/03-items/guns/cat-special-weapon.svg' },
            ]
          },
          // 5. БОЕПРИПАСЫ
          {
            id: 'i-ammo',
            label: 'Боеприпасы',
            path: '/eft/items/ammo',
            iconUrl: '/icons/eft/03-items/guns/cat-ammo.svg',
            children: [
              { id: 'i-ammo-rounds', label: 'Патроны', path: '/eft/items/ammo/rounds', iconUrl: '/icons/eft/03-items/guns/cat-ammo.svg' },
              { id: 'i-ammo-boxes', label: 'Пачки патронов', path: '/eft/items/ammo/ammo-boxes', iconUrl: '/icons/eft/03-items/guns/cat-ammo-package.svg' },
            ]
          },
          // 6. ПРОВИЗИЯ
          {
            id: 'i-provisions',
            label: 'Провизия',
            path: '/eft/items/provisions',
            iconUrl: '/icons/eft/03-items/equipment/provisions.svg',
            children: [
              { id: 'i-prov-food', label: 'Еда', path: '/eft/items/provisions/food', iconUrl: '/icons/eft/03-items/equipment/provisions/food.svg' },
              { id: 'i-prov-drinks', label: 'Напитки', path: '/eft/items/provisions/drinks', iconUrl: '/icons/eft/03-items/equipment/provisions/drinks.svg' }
            ]
          },
          // 7. МЕДИКАМЕНТЫ
          {
            id: 'i-meds',
            label: 'Медикаменты',
            path: '/eft/items/meds',
            iconUrl: '/icons/eft/03-items/equipment/meds.svg',
            children: [
              { id: 'i-meds-medkits', label: 'Аптечки', path: '/eft/items/meds/medkits', iconUrl: '/icons/eft/03-items/equipment/meds/medkits.svg' },
              { id: 'i-meds-injectors', label: 'Инъекторы', path: '/eft/items/meds/injectors', iconUrl: '/icons/eft/03-items/equipment/meds/injectors.svg' },
              { id: 'i-meds-injury', label: 'Обработка ранений', path: '/eft/items/meds/injury', iconUrl: '/icons/eft/03-items/equipment/meds/injury-treatment.svg' },
              { id: 'i-meds-pills', label: 'Таблетки', path: '/eft/items/meds/pills', iconUrl: '/icons/eft/03-items/equipment/meds/pills.svg' }
            ]
          },
          // 8. КЛЮЧИ
          {
            id: 'i-keys',
            label: 'Ключи',
            path: '/eft/items/keys',
            iconUrl: '/icons/eft/03-items/equipment/keys.svg',
            children: [
              {
                id: 'i-keys-mech',
                label: 'Механические ключи',
                path: '/eft/items/keys/mechanical',
                iconUrl: '/icons/eft/03-items/equipment/keys/mechanical-keys.svg',
                children: [
                  { id: 'i-keys-marked', label: 'Меченые Ключи', path: '/eft/items/keys/mechanical/marked', iconUrl: '/icons/eft/03-items/equipment/keys/mechanical-keys/marked-keys.svg' },
                  { id: 'i-keys-quest', label: 'Ключи для Заданий', path: '/eft/items/keys/mechanical/quest', iconUrl: '/icons/eft/03-items/equipment/keys/mechanical-keys/quest-keys.svg' }
                ]
              },
              { id: 'i-keys-cards', label: 'Ключ-карты', path: '/eft/items/keys/keycards', iconUrl: '/icons/eft/03-items/equipment/keys/key-cards.svg' }
            ]
          },
          // 9. ПРЕДМЕТЫ ДЛЯ ЗАДАНИЙ
          { id: 'i-questitems', label: 'Предметы для Заданий', menuTitle: 'Для Заданий', path: '/eft/items/quest-items', iconUrl: '/icons/eft/03-items/questitems.svg', iconClass: 'icon-eft-questitems' },
          // 10. ИНФО ПРЕДМЕТЫ
          { id: 'i-info', label: 'Инфо предметы', path: '/eft/items/info', iconUrl: '/icons/eft/03-items/equipment/infoitems.svg' },
          // 11. СПЕЦОБОРУДОВАНИЕ
          { id: 'i-specialequipment', label: 'Спецоборудование', path: '/eft/items/specialequipment', iconUrl: '/icons/eft/03-items/equipment/special-equipment.svg' },
        ]
      },
      {
        id: 'progress',
        label: 'Прогресс',
        path: '/eft/progress',
        iconUrl: '/icons/eft/progress-icon.svg',
        children: [
          { id: 'p-hub', label: 'Досье игрока', description: 'Твой тактический профиль: архетип, боевая эффективность, карма и весь прогресс в одном экране.', path: '/eft/hub', iconUrl: '/icons/eft/04-progression/utarkov.svg' },
          { id: 'p-rookie', label: 'Аркады', description: 'Зал автоматов: аркадные мини-игры по вселенной Таркова. Новичку — подраздел «Путь Новобранца», курс из 10 этапов.', path: '/eft/progress/rookie', iconUrl: '/icons/eft/04-progression/eft-arcade-icon.svg', iconClass: 'icon-eft-arcade' },
          {
            id: 'p-hideout',
            label: 'Убежище ЧВК',
            description: 'Развивайте свою базу, создавайте предметы и получайте пассивные бонусы для вашего персонажа.',
            path: '/eft/progress/hideout',
            iconUrl: '/icons/eft/04-progression/hideout-modules.svg',
            children: [
              { id: 'p-hideout-modules', label: 'Модули убежища', path: '/eft/progress/hideout/modules', iconUrl: '/icons/eft/04-progression/hideout-modules.svg' },
              { id: 'p-hideout-craft', label: 'Прибыль убежища', path: '/eft/progress/hideout/craft-profit', iconUrl: '/icons/eft/04-progression/craft-profit.svg' },
              { id: 'p-hideout-btc', label: 'Прибыль Bitcoin', path: '/eft/progress/hideout/bitcoin-profit', iconUrl: '/icons/eft/04-progression/bitcoin-profit.svg' }
            ]
          },
          {
            id: 'p-seasons',
            label: 'Сезоны',
            description: 'Механика сезонного персонажа и интерактивный конструктор модификаторов с бюджетом очков.',
            path: '/eft/progress/seasons',
            iconUrl: '/icons/eft/04-progression/seasons/seasons-icon.svg',
            iconClass: 'icon-eft-seasons',
            children: [
              { id: 'p-seasons-perks', label: 'Конструктор перков', path: '/eft/progress/seasons/perks', iconUrl: '/icons/eft/04-progression/seasons/build-constructor.svg' },
              { id: 'p-seasons-tracker', label: 'BATTLEPASS Трекер', description: 'Отмечайте полученные награды Боевого Пропуска — трекер посчитает, сколько документации ещё нужно и на каких картах её искать.', path: '/eft/progress/seasons/tracker', iconUrl: '/icons/eft/04-progression/seasons/battlepass-docs-tracker-icon.svg' },
            ],
          },
          {
            id: 'p-loadouts',
            label: 'Сборки оружия',
            description: 'Создавайте, сохраняйте и делитесь своими лучшими сборками оружия с сообществом.',
            path: '/eft/progress/loadouts',
            iconUrl: '/icons/eft/04-progression/gun-loadouts.svg',
            children: [
              { id: 'p-loadouts-my', label: 'Мои сборки', path: '/eft/progress/loadouts/my', iconUrl: '/icons/eft/04-progression/gun-loadouts/my-gun-loadouts.svg' },
              { id: 'p-loadouts-find', label: 'Найти сборку', path: '/eft/progress/loadouts/find', iconUrl: '/icons/eft/04-progression/gun-loadouts/find-gun-loadout.svg' },
              { id: 'p-loadouts-add', label: 'Создать сборку', path: '/eft/progress/loadouts/add', iconUrl: '/icons/eft/04-progression/gun-loadouts/add-gun-loadout.svg' }
            ]
          },
          { id: 'p-tracker', label: 'Трекер предметов', description: 'Отмечайте найденные предметы для квестов, убежища и бартеров в удобном чек-листе.', path: '/eft/progress/tracker', iconUrl: '/icons/eft/04-progression/items-tracker.svg' },
          { id: 'p-needed', label: 'Важные предметы', description: 'Полный список всех предметов, необходимых для выполнения заданий и постройки убежища.', path: '/eft/progress/needed', iconUrl: '/icons/eft/04-progression/items-needed.svg' }
        ]
      },
      { 
        id: 'gamesetting', 
        label: 'Кодекс', 
        path: '/eft/gamesetting',
        iconUrl: '/icons/eft/codex-icon.svg',
        children: [
          { id: 'gs-lore', label: 'История мира', description: 'Погрузитесь в историю вселенной Russia 2028, предшествующую событиям в Таркове.', path: '/eft/gamesetting/lore', iconUrl: '/icons/eft/05-gamesetting/tarkov-lore.svg' },
          { id: 'gs-timeline', label: 'Хронология', description: 'Ключевые события, приведшие к конфликту в Норвинской области, в хронологическом порядке.', path: '/eft/gamesetting/timeline', iconUrl: '/icons/eft/05-gamesetting/timeline.svg' },
          { id: 'gs-game-updates', label: 'Обновления игры', description: 'Патчи и «что реально изменилось» — статы, торговцы, крафты и квесты с разбором на русском.', path: '/eft/gamesetting/game-updates', iconUrl: '/icons/eft/05-gamesetting/game-updates.svg', iconClass: 'icon-eft-lore-game-updates' },
          {
            id: 'gs-characters',
            label: 'Персонажи',
            description: 'Досье на ключевых действующих лиц: боссов, торговцев и других важных персонажей.',
            path: '/eft/gamesetting/characters',
            iconUrl: '/icons/eft/05-gamesetting/characters.svg',
            children: [
              { id: 'gs-bosses', label: 'Боссы', path: '/eft/gamesetting/bosses', iconUrl: '/icons/eft/05-gamesetting/bosses.svg' },
              { id: 'gs-traders', label: 'Торговцы', path: '/eft/gamesetting/traders', iconUrl: '/icons/eft/05-gamesetting/traders.svg' }
            ]
          },
          { id: 'gs-factions', label: 'Фракции', description: 'Информация о противоборствующих сторонах: USEC, BEAR и Диких.', path: '/eft/gamesetting/factions', iconUrl: '/icons/eft/05-gamesetting/fractions.svg' },
          { id: 'gs-corporations', label: 'Корпорации', description: 'Сведения о TerraGroup, ее деятельности и других корпорациях, замешанных в конфликте.', path: '/eft/gamesetting/corporations', iconUrl: '/icons/eft/05-gamesetting/corporations.svg' },
          { id: 'gs-locations', label: 'Локации', description: 'История и описание ключевых мест в Таркове и его окрестностях.', path: '/eft/gamesetting/locations', iconUrl: '/icons/eft/05-gamesetting/locations.svg' },
          {
            id: 'gs-materials',
            label: 'Материалы',
            description: 'Сборник внутриигровых документов, аудиозаписей и записок, раскрывающих сюжет.',
            path: '/eft/gamesetting/materials',
            iconUrl: '/icons/eft/05-gamesetting/docs-notes.svg',
            children: [
              { id: 'gs-audio', label: 'Аудиозаписи', path: '/eft/gamesetting/audiotapes', iconUrl: '/icons/eft/05-gamesetting/audiotapes.svg' },
              { id: 'gs-docs', label: 'Документы и записки', path: '/eft/gamesetting/docs-notes', iconUrl: '/icons/eft/05-gamesetting/docs-notes.svg' }
            ]
          },
          { id: 'gs-theories', label: 'Теории и загадки', description: 'Разбор фанатских теорий, неразгаданных тайн и загадок мира Escape from Tarkov.', path: '/eft/gamesetting/theories', iconUrl: '/icons/eft/05-gamesetting/theory-riddles.svg' },
          { id: 'gs-achievements', label: 'Достижения', description: 'Отслеживайте свои внутриигровые достижения, от сюжетных вех до уникальных испытаний.', path: '/eft/progress/achievements', iconUrl: '/icons/eft/04-progression/achievments.svg' },
          { id: 'gs-prestige', label: 'Престиж', description: 'Продемонстрируйте свой опыт и получите уникальные награды после достижения максимального уровня.', path: '/eft/progress/prestige', iconUrl: '/icons/eft/04-progression/prestige.svg' }
        ]
      },
      { 
        id: 'videos', 
        label: 'Видео', 
        path: '/eft/videos', 
        iconUrl: '/icons/eft/videos-icon.svg',
        children: [
          { id: 'v-guides', label: 'Гайды', path: '/eft/videos/guides', iconUrl: '/icons/eft/06-videos/video-guides.svg' },
          { id: 'v-advices', label: 'Советы', path: '/eft/videos/advices', iconUrl: '/icons/eft/06-videos/video-advices.svg' },
          { id: 'v-news', label: 'Новости', path: '/eft/videos/news', iconUrl: '/icons/eft/06-videos/video-news.svg' },
          { id: 'v-streams', label: 'Стримы', path: '/eft/videos/streams', iconUrl: '/icons/eft/06-videos/live-streams.svg' }
        ]
      },
      // ВЕТКА: СВЯЗЬ (сообщество) — навигируемые смарт-заглушки (MVP), реал — отдельный эпик.
      // Иконки подпунктов — фирменная графика из /icons/eft/07-comlink.
      {
        id: 'comlink',
        label: 'Связь',
        path: '/eft/comlink',
        iconUrl: '/icons/eft/00-nav/comlink-icon.svg',
        children: [
          { id: 'cl-find-partner', label: 'Поиск напарника', description: 'Заявки на совместные рейды, подтверждения и оценки напарников.', path: '/eft/comlink/find-partner', iconUrl: '/icons/eft/07-comlink/find-partner.svg' },
          { id: 'cl-candidates', label: 'Кандидаты', description: 'Анкеты игроков, ищущих команду или сокомандников.', path: '/eft/comlink/candidates', iconUrl: '/icons/eft/07-comlink/candidates.svg' },
          { id: 'cl-sherpa', label: 'Биржа шерпов', description: 'Опытные игроки-наставники помогают новичкам освоиться.', path: '/eft/comlink/sherpa-exchange', iconUrl: '/icons/eft/07-comlink/sherpa.svg' },
          { id: 'cl-discussions', label: 'Обсуждения', description: 'Темы по игре: мета, споты, механики. У каждого автора виден уровень доверия.', path: '/eft/comlink/discussions', iconUrl: '/icons/eft/07-comlink/discussions.svg' },
          { id: 'cl-masterclasses', label: 'Мастер-классы', description: 'Разборы, обучающие сессии и гайды от профи.', path: '/eft/comlink/masterclasses', iconUrl: '/icons/eft/07-comlink/masterclasses.svg' },
          { id: 'cl-blog', label: 'Новостной блог', description: 'Новости проекта ЦТА, статьи и объявления.', path: '/eft/comlink/blog', iconUrl: '/icons/eft/07-comlink/blog.svg' }
        ]
      },
    ],
    currencySymbol: '₽',
  },
  frago: {
    searchPlaceholder: 'ПОИСК ПО БАЗЕ ДАННЫХ СЕКТОРОВ...',
    menuItems: [
      { id: 'sectors', label: 'Секторы', path: '/frago/sectors' },
      { id: 'missions', label: 'Миссии', path: '/frago/missions' },
      { id: 'weapons', label: 'Вооружение', path: '/frago/weapons' },
      { id: 'blueprints', label: 'Чертежи', path: '/frago/blueprints' },
      { id: 'modules', label: 'Модули', path: '/frago/modules' },
    ],
    currencySymbol: 'Кр.',
  },
  abi: {
    searchPlaceholder: 'ПОИСК ТАКТИЧЕСКОЙ ЭКИПИРОВКИ...',
    menuItems: [
      { id: 'maps', label: 'Карты', path: '/abi/maps' },
      { id: 'operations', label: 'Операции', path: '/abi/operations' },
      { id: 'gear', label: 'Снаряжение', path: '/abi/gear' },
      { id: 'weapons', label: 'Оружие', path: '/abi/weapons' },
      { id: 'market', label: 'Рынок', path: '/abi/market' },
    ],
    currencySymbol: 'Koen',
  },
  gzw: {
    searchPlaceholder: 'ПОИСК ДАННЫХ РАЗВЕДКИ...',
    menuItems: [
      { id: 'zones', label: 'Зоны', path: '/gzw/zones' },
      { id: 'contracts', label: 'Контракты', path: '/gzw/contracts' },
      { id: 'arsenal', label: 'Арсенал', path: '/gzw/arsenal' },
      { id: 'stashes', label: 'Схроны', path: '/gzw/stashes' },
      { id: 'factions', label: 'Фракции', path: '/gzw/factions' },
    ],
    currencySymbol: '$',
  },
  actmat: {
    searchPlaceholder: 'ПОИСК АНОМАЛИЙ И АРТЕФАКТОВ...',
    menuItems: [
      { id: 'anomalies', label: 'Аномалии', path: '/actmat/anomalies' },
    ],
    currencySymbol: 'AM',
  },
  arcraiders: {
    searchPlaceholder: 'ПОИСК РЕСУРСОВ И ЧЕРТЕЖЕЙ...',
    menuItems: [
      { id: 'blueprints', label: 'Чертежи', path: '/arcraiders/blueprints' },
    ],
    currencySymbol: 'Cr.',
  },
  marathon: {
    searchPlaceholder: 'ПОИСК КОНТРАКТОВ И ИМПЛАНТОВ...',
    menuItems: [
      { id: 'implants', label: 'Импланты', path: '/marathon/implants' },
    ],
    currencySymbol: 'M',
  },
  wardogs: {
    searchPlaceholder: 'ПОИСК СНАРЯЖЕНИЯ И ЗАКАЗОВ...',
    menuItems: [
      { id: 'contracts', label: 'Заказы', path: '/wardogs/contracts' },
    ],
    currencySymbol: '$',
  },
};

/**
 * Получает конфигурацию хедера на основе текущего пути (pathname).
 * Возвращает дефолтную конфигурацию (EFT), если игра не найдена.
 */
export function getHeaderConfig(pathname: string): HeaderConfig {
  // Разбиваем путь (например, "/eft/maps" -> ["eft", "maps"])
  const segments = pathname.split('/').filter(Boolean);
  const gameId = segments[0] || 'eft';
  
  return HEADER_DICTIONARY[gameId] || HEADER_DICTIONARY['eft'];
}