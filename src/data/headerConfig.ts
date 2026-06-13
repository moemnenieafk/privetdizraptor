export interface MenuItem {
  id: string;
  label: string;
  path?: string;
  iconUrl?: string;
  iconUrlBear?: string;
  iconUrlUsec?: string;
  iconClass?: string;
  coloredIcon?: boolean;
  children?: MenuItem[];
  subItems?: MenuItem[]; //Для вложенных меню
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
      'price-slot': 'Цена за слот',
      'loot-rate': 'Рейтинг предметов',
      headphones: 'Наушники',
      helmets: 'Шлемы',
      masks: 'Маски',
      visors: 'Очки и Визоры',
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
      progress: 'Прогресс',
      achievements: 'Достижения',
      tracker: 'Трекер',
      keepitems: 'Нужные предметы',
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
      barter: 'Прибыль бартера',
      barters: 'Бартеры',
      weapons: 'Сборки',
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
      icebreaker: 'ЛЕДОКОЛ',
      'end-of-line': 'КОНЕЦ ПУТИ',
    },
    menuItems: [
      // ВЕТКА 1: КАРТЫ (Полностью структурированная)
      { 
        id: 'maps', 
        label: 'Карты', 
        iconUrl: '/icons/eft/maps-icon.svg',
        path: '/eft/maps',
        children: [
          { id: 'lab', label: 'ЛАБОРАТОРИЯ', iconUrl: '/icons/eft/01-maps/lab-map-icon.svg', path: '/eft/maps/lab' },
          { id: 'groundzero', label: 'ЭПИЦЕНТР', iconUrl: '/icons/eft/01-maps/groundzero-map-icon.svg', path: '/eft/maps/groundzero' },
          { id: 'streets', label: 'УЛИЦЫ ТАРКОВА', iconUrl: '/icons/eft/01-maps/streets-map-icon.svg', path: '/eft/maps/streets' },
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
          }
        ]
      },
      {
        id: 'items',
        label: 'Предметы',
        path: '/eft/items', // Уже ведет на /eft/items, но теперь это будет наш хаб
        iconUrl: '/icons/eft/03-items/loot-tier.svg',
        children: [
          { id: 'i-loot-rate', label: 'Рейтинг предметов', path: '/eft/items/loot-rate', iconUrl: '/icons/eft/03-items/loot-tier.svg' },
          {
            id: 'i-gear',
            label: 'Снаряжение',
            path: '/eft/items/gear',
            iconUrl: '/icons/eft/03-items/gear.svg',
            children: [
              { id: 'i-gear-headphones', label: 'Наушники', path: '/eft/items/gear/headphones', iconUrl: '/icons/eft/03-items/gear/cat-headphones.svg' },
              { id: 'i-gear-helmets', label: 'Шлемы', path: '/eft/items/gear/helmets', iconUrl: '/icons/eft/03-items/gear/cat-helmets.svg' },
              { id: 'i-gear-masks', label: 'Маски', path: '/eft/items/gear/masks', iconUrl: '/icons/eft/03-items/gear/cat-masks.svg' },
              { id: 'i-gear-visors', label: 'Очки и Визоры', path: '/eft/items/gear/visors', iconUrl: '/icons/eft/03-items/gear/cat-visors.svg' },
              { id: 'i-gear-armor', label: 'Бронежилеты', path: '/eft/items/gear/armor', iconUrl: '/icons/eft/03-items/gear/cat-armor.svg' },
              { id: 'i-gear-rigs', label: 'Разгрузки', path: '/eft/items/gear/rigs', iconUrl: '/icons/eft/03-items/gear/cat-tactical-rigs.svg' },
              { id: 'i-gear-backpacks', label: 'Рюкзаки', path: '/eft/items/gear/backpacks', iconUrl: '/icons/eft/03-items/gear/cat-backpacks.svg' },
              { id: 'i-gear-components', label: 'Компоненты', path: '/eft/items/gear/components', iconUrl: '/icons/eft/03-items/gear/cat-gearcomps.svg' }
            ]
          },
          {
            id: 'i-guns',
            label: 'Оружие',
            path: '/eft/items/guns',
            iconUrl: '/icons/eft/03-items/guns.svg',
            children: [
              { id: 'i-guns-ammo', label: 'Боеприпасы', path: '/eft/items/guns/ammo', iconUrl: '/icons/eft/03-items/guns/cat-ammo.svg' },
              { id: 'i-guns-grenades', label: 'Гранаты', path: '/eft/items/guns/grenades', iconUrl: '/icons/eft/03-items/guns/cat-grenades.svg' },
              {
                id: 'i-guns-firearms',
                label: 'Огнестрельное',
                path: '/eft/items/guns/firearms',
                iconUrl: '/icons/eft/03-items/guns.svg',
                children: [
                  { id: 'i-guns-gl', label: 'Гранатометы', path: '/eft/items/guns/firearms/gl', iconUrlBear: '/icons/eft/03-items/guns/gun-types/gl-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/gl-usec.svg' },
                  { id: 'i-guns-bolt', label: 'Болтовые винтовки', path: '/eft/items/guns/firearms/bolt', iconUrlBear: '/icons/eft/03-items/guns/gun-types/bolt-action-riffle-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/bolt-action-riffle-usec.svg' },
                  { id: 'i-guns-dmr', label: 'Пехотные винтовки', path: '/eft/items/guns/firearms/dmr', iconUrlBear: '/icons/eft/03-items/guns/gun-types/dmr-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/dmr-usec.svg' },
                  { id: 'i-guns-ar', label: 'Штурмовые винтовки', path: '/eft/items/guns/firearms/ar', iconUrlBear: '/icons/eft/03-items/guns/gun-types/ar-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/ar-usec.svg' },
                  { id: 'i-guns-carbine', label: 'Карабины', path: '/eft/items/guns/firearms/carbine', iconUrlBear: '/icons/eft/03-items/guns/gun-types/carbine-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/carbine-usec.svg' },
                  { id: 'i-guns-lmg', label: 'Пулеметы', path: '/eft/items/guns/firearms/lmg', iconUrlBear: '/icons/eft/03-items/guns/gun-types/lmg-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/lmg-usec.svg' },
                  { id: 'i-guns-shotgun', label: 'Дробовики', path: '/eft/items/guns/firearms/shotgun', iconUrlBear: '/icons/eft/03-items/guns/gun-types/shotgun-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/shotgun-usec.svg' },
                  { id: 'i-guns-smg', label: 'Пистолеты-Пулеметы', path: '/eft/items/guns/firearms/smg', iconUrlBear: '/icons/eft/03-items/guns/gun-types/smg-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/smg_usec.svg' },
                  { id: 'i-guns-sidearm', label: 'Пистолеты', path: '/eft/items/guns/firearms/sidearm', iconUrlBear: '/icons/eft/03-items/guns/gun-types/sidearm-bear.svg', iconUrlUsec: '/icons/eft/03-items/guns/gun-types/sidearm-usec.svg' }
                ]
              },
              {
                id: 'i-guns-mods',
                label: 'Моды',
                path: '/eft/items/guns/mods',
                iconUrl: '/icons/eft/03-items/guns/cat-gunmods.svg',
                children: [
                  {
                    id: 'i-guns-mods-vitalparts',
                    label: 'Критические',
                    path: '/eft/items/guns/mods/vitalparts',
                    iconUrl: '/icons/eft/03-items/guns/gun-modes/vital-parts.svg',
                    children: [
                      { id: 'i-mods-crit-gasblocks', label: 'Газовые трубки', path: '/eft/items/guns/mods/vitalparts/gasblocks', iconUrl: '/icons/eft/03-items/guns/gun-modes/gas-blocks.svg' },
                      { id: 'i-mods-crit-receivers', label: 'Крышки и ресиверы', path: '/eft/items/guns/mods/vitalparts/receivers', iconUrl: '/icons/eft/03-items/guns/gun-modes/receivers-slides.svg' },
                      { id: 'i-mods-crit-pistolgrips', label: 'Рукоятки', path: '/eft/items/guns/mods/vitalparts/pistol-grips', iconUrl: '/icons/eft/03-items/guns/gun-modes/pistol-grips.svg' },
                      { id: 'i-mods-crit-barrels', label: 'Стволы', path: '/eft/items/guns/mods/vitalparts/barrels', iconUrl: '/icons/eft/03-items/guns/gun-modes/barrels.svg' },
                      { id: 'i-mods-crit-handguards', label: 'Цевья', path: '/eft/items/guns/mods/vitalparts/handguards', iconUrl: '/icons/eft/03-items/guns/gun-modes/handguards.svg' }
                    ]
                  },
                  {
                    id: 'i-guns-mods-functional',
                    label: 'Функциональные',
                    path: '/eft/items/guns/mods/functional',
                    iconUrl: '/icons/eft/03-items/guns/gun-modes/functional-mods.svg',
                    children: [
                      { id: 'i-mods-func-aux', label: 'Вспом. части', path: '/eft/items/guns/mods/functional/auxiliary', iconUrl: '/icons/eft/03-items/guns/gun-modes/auxiliary-parts.svg' },
                      { id: 'i-mods-func-muzzle', label: 'Дульные устройства', path: '/eft/items/guns/mods/functional/muzzle', iconUrl: '/icons/eft/03-items/guns/gun-modes/muzzle-devices.svg' },
                      { id: 'i-mods-func-sights', label: 'Прицелы', path: '/eft/items/guns/mods/functional/sights', iconUrl: '/icons/eft/03-items/guns/gun-modes/sights.svg' },
                      { id: 'i-mods-func-laser', label: 'Фонарики и ЛЦУ', path: '/eft/items/guns/mods/functional/laser', iconUrl: '/icons/eft/03-items/guns/gun-modes/light-laser-device.svg' },
                      { id: 'i-mods-func-bipods', label: 'Сошки', path: '/eft/items/guns/mods/functional/bipods', iconUrl: '/icons/eft/03-items/guns/gun-modes/bipods.svg' },
                      { id: 'i-mods-func-foregrips', label: 'Такт. рукоятки', path: '/eft/items/guns/mods/functional/foregrips', iconUrl: '/icons/eft/03-items/guns/gun-modes/foregrips.svg' }
                    ]
                  },
                  {
                    id: 'i-guns-mods-elements',
                    label: 'Элементы',
                    path: '/eft/items/guns/mods/elements',
                    iconUrl: '/icons/eft/03-items/guns/gun-modes/gear-mods.svg',
                    children: [
                      { id: 'i-mods-elem-mounts', label: 'Крепления', path: '/eft/items/guns/mods/elements/mounts', iconUrl: '/icons/eft/03-items/guns/gun-modes/mounts.svg' },
                      { id: 'i-mods-elem-magazines', label: 'Магазины', path: '/eft/items/guns/mods/elements/magazines', iconUrl: '/icons/eft/03-items/guns/gun-modes/magazines.svg' },
                      { id: 'i-mods-elem-stocks', label: 'Приклады и Ложе', path: '/eft/items/guns/mods/elements/stocks', iconUrl: '/icons/eft/03-items/guns/gun-modes/stocks-chassis.svg' },
                      { id: 'i-mods-elem-handles', label: 'Рукоятки заряжания', path: '/eft/items/guns/mods/elements/charging-handles', iconUrl: '/icons/eft/03-items/guns/gun-modes/charging-handles.svg' }
                    ]
                  }
                ]
              },
              { id: 'i-guns-melee', label: 'Холодное', path: '/eft/items/guns/melee', iconUrl: '/icons/eft/03-items/guns/cat-knifes.svg' },
              { id: 'i-guns-special', label: 'Специальное', path: '/eft/items/guns/special', iconUrl: '/icons/eft/03-items/guns/cat-special-weapon.svg' }
            ]
          },
          {
            id: 'i-equipment',
            label: 'Оборудование',
            path: '/eft/items/equipment',
            iconUrl: '/icons/eft/03-items/equipment.svg',
            children: [
              {
                id: 'i-eq-meds',
                label: 'Медикаменты',
                path: '/eft/items/equipment/meds',
                iconUrl: '/icons/eft/03-items/equipment/meds.svg',
                children: [
                  { id: 'i-meds-medkits', label: 'Аптечки', path: '/eft/items/equipment/meds/medkits', iconUrl: '/icons/eft/03-items/equipment/meds/medkits.svg' },
                  { id: 'i-meds-injectors', label: 'Инъекторы', path: '/eft/items/equipment/meds/injectors', iconUrl: '/icons/eft/03-items/equipment/meds/injectors.svg' },
                  { id: 'i-meds-injury', label: 'Обработка ранений', path: '/eft/items/equipment/meds/injury', iconUrl: '/icons/eft/03-items/equipment/meds/injury-treatment.svg' },
                  { id: 'i-meds-pills', label: 'Таблетки', path: '/eft/items/equipment/meds/pills', iconUrl: '/icons/eft/03-items/equipment/meds/pills.svg' }
                ]
              },
              { id: 'i-eq-info', label: 'Инфопредметы', path: '/eft/items/equipment/info', iconUrl: '/icons/eft/03-items/equipment/infoitems.svg' },
              {
                id: 'i-eq-keys',
                label: 'Ключи',
                path: '/eft/items/equipment/keys',
                iconUrl: '/icons/eft/03-items/equipment/keys.svg',
                children: [
                  {
                    id: 'i-keys-mech',
                    label: 'Механические ключи',
                    path: '/eft/items/equipment/keys/mechanical',
                    iconUrl: '/icons/eft/03-items/equipment/keys/mechanical-keys.svg',
                    children: [
                      { id: 'i-keys-marked', label: 'Меченые Ключи', path: '/eft/items/equipment/keys/mechanical/marked', iconUrl: '/icons/eft/03-items/equipment/keys/mechanical-keys/marked-keys.svg' },
                      { id: 'i-keys-quest', label: 'Ключи для Заданий', path: '/eft/items/equipment/keys/mechanical/quest', iconUrl: '/icons/eft/03-items/equipment/keys/mechanical-keys/quest-keys.svg' }
                    ]
                  },
                  { id: 'i-keys-cards', label: 'Ключ-карты', path: '/eft/items/equipment/keys/keycards', iconUrl: '/icons/eft/03-items/equipment/keys/key-cards.svg' }
                ]
              },
              {
                id: 'i-eq-containers',
                label: 'Контейнеры',
                path: '/eft/items/equipment/containers',
                iconUrl: '/icons/eft/03-items/equipment/containers.svg',
                children: [
                  { id: 'i-cont-cases', label: 'Кейсы', path: '/eft/items/equipment/containers/cases', iconUrl: '/icons/eft/03-items/equipment/containers/cases.svg' },
                  { id: 'i-cont-secure', label: 'Защищенные', path: '/eft/items/equipment/containers/secure', iconUrl: '/icons/eft/03-items/equipment/containers/secure-containers.svg' }
                ]
              },
              {
                id: 'i-eq-provisions',
                label: 'Провизия',
                path: '/eft/items/equipment/provisions',
                iconUrl: '/icons/eft/03-items/equipment/provisions.svg',
                children: [
                  { id: 'i-prov-food', label: 'Еда', path: '/eft/items/equipment/provisions/food', iconUrl: '/icons/eft/03-items/equipment/provisions/food.svg' },
                  { id: 'i-prov-drinks', label: 'Напитки', path: '/eft/items/equipment/provisions/drinks', iconUrl: '/icons/eft/03-items/equipment/provisions/drinks.svg' }
                ]
              },
              { id: 'i-eq-special', label: 'Спецоборудование', path: '/eft/items/equipment/special', iconUrl: '/icons/eft/03-items/equipment/special-equipment.svg' }
            ]
          },
          { id: 'i-price-slot', label: 'Цена за слот', path: '/eft/items/price-slot', iconUrl: '/icons/eft/03-items/price-per-slot.svg' }
        ]
      },
      {
        id: 'progress',
        label: 'Прогресс',
        path: '/eft/progress',
        iconUrl: '/icons/eft/progress-icon.svg',
        children: [
          { id: 'p-achievements', label: 'Достижения', path: '/eft/progress/achievements', iconUrl: '/icons/eft/04-progression/achievments.svg' },
          { id: 'p-prestige', label: 'Престиж', path: '/eft/progress/prestige', iconUrl: '/icons/eft/04-progression/prestige.svg' },
          {
            id: 'p-hideout',
            label: 'Убежище ЧВК',
            path: '/eft/progress/hideout',
            iconUrl: '/icons/eft/04-progression/hideout-modules.svg',
            children: [
              { 
                id: 'p-hideout-modules', 
                label: 'Модули убежища', 
                path: '/eft/progress/hideout/modules', 
                iconUrl: '/icons/eft/04-progression/hideout-modules.svg',
                children: [
                  { id: 'p-hideout-mod-defective-wall', label: 'Аварийная стена', path: '/eft/progress/hideout/modules/defective-wall', iconUrl: '/icons/eft/04-progression/hideout-modules/defective_wall.svg' },
                  { id: 'p-hideout-mod-security', label: 'Безопасность', path: '/eft/progress/hideout/modules/security', iconUrl: '/icons/eft/04-progression/hideout-modules/security.svg' },
                  { id: 'p-hideout-mod-bitcoin-farm', label: 'Биткоин ферма', path: '/eft/progress/hideout/modules/bitcoin-farm', iconUrl: '/icons/eft/04-progression/hideout-modules/bitcoin_farm.svg' },
                  { id: 'p-hideout-mod-vents', label: 'Вентиляция', path: '/eft/progress/hideout/modules/vents', iconUrl: '/icons/eft/04-progression/hideout-modules/vents.svg' },
                  { id: 'p-hideout-mod-workbench', label: 'Верстак', path: '/eft/progress/hideout/modules/workbench', iconUrl: '/icons/eft/04-progression/hideout-modules/workbench.svg' },
                  { id: 'p-hideout-mod-air-filtering-unit', label: 'Воздушный фильтратор', path: '/eft/progress/hideout/modules/air-filtering-unit', iconUrl: '/icons/eft/04-progression/hideout-modules/air_filtering_unit.svg' },
                  { id: 'p-hideout-mod-water-collector', label: 'Водосборник', path: '/eft/progress/hideout/modules/water-collector', iconUrl: '/icons/eft/04-progression/hideout-modules/water_collector.svg' },
                  { id: 'p-hideout-mod-generator', label: 'Генератор', path: '/eft/progress/hideout/modules/generator', iconUrl: '/icons/eft/04-progression/hideout-modules/generator.svg' },
                  { id: 'p-hideout-mod-rest-space', label: 'Зона отдыха', path: '/eft/progress/hideout/modules/rest-space', iconUrl: '/icons/eft/04-progression/hideout-modules/rest_space.svg' },
                  { id: 'p-hideout-mod-cultist-circle', label: 'Круг сектантов', path: '/eft/progress/hideout/modules/cultist-circle', iconUrl: '/icons/eft/04-progression/hideout-modules/cultist_circle.svg' },
                  { id: 'p-hideout-mod-med-station', label: 'Медблок', path: '/eft/progress/hideout/modules/med-station', iconUrl: '/icons/eft/04-progression/hideout-modules/med_station.svg' },
                  { id: 'p-hideout-mod-heating', label: 'Обогрев', path: '/eft/progress/hideout/modules/heating', iconUrl: '/icons/eft/04-progression/hideout-modules/heating.svg' },
                  { id: 'p-hideout-mod-weapon-rack', label: 'Оружейный стенд', path: '/eft/progress/hideout/modules/weapon-rack', iconUrl: '/icons/eft/04-progression/hideout-modules/weapon_rack.svg' },
                  { id: 'p-hideout-mod-illumination', label: 'Освещение', path: '/eft/progress/hideout/modules/illumination', iconUrl: '/icons/eft/04-progression/hideout-modules/illumination.svg' },
                  { id: 'p-hideout-mod-nutrition-unit', label: 'Пищеблок', path: '/eft/progress/hideout/modules/nutrition-unit', iconUrl: '/icons/eft/04-progression/hideout-modules/nutrition_unit.svg' },
                  { id: 'p-hideout-mod-intelligence-centre', label: 'Разведцентр', path: '/eft/progress/hideout/modules/intelligence-centre', iconUrl: '/icons/eft/04-progression/hideout-modules/intelligence_centre.svg' },
                  { id: 'p-hideout-mod-booze-generator', label: 'Самогонный аппарат', path: '/eft/progress/hideout/modules/booze-generator', iconUrl: '/icons/eft/04-progression/hideout-modules/booze_generator.svg' },
                  { id: 'p-hideout-mod-lavatory', label: 'Санузел', path: '/eft/progress/hideout/modules/lavatory', iconUrl: '/icons/eft/04-progression/hideout-modules/lavatory.svg' },
                  { id: 'p-hideout-mod-stash', label: 'Склад', path: '/eft/progress/hideout/modules/stash', iconUrl: '/icons/eft/04-progression/hideout-modules/stash.svg' },
                  { id: 'p-hideout-mod-solar-power', label: 'Солнечная батарея', path: '/eft/progress/hideout/modules/solar-power', iconUrl: '/icons/eft/04-progression/hideout-modules/solar_power.svg' },
                  { id: 'p-hideout-mod-gear-rack', label: 'Стенд со снаряжением', path: '/eft/progress/hideout/modules/gear-rack', iconUrl: '/icons/eft/04-progression/hideout-modules/gear_rack.svg' },
                  { id: 'p-hideout-mod-shooting-range', label: 'Тир', path: '/eft/progress/hideout/modules/shooting-range', iconUrl: '/icons/eft/04-progression/hideout-modules/shooting_range.svg' },
                  { id: 'p-hideout-mod-gym', label: 'Тренажерный зал', path: '/eft/progress/hideout/modules/gym', iconUrl: '/icons/eft/04-progression/hideout-modules/gym.svg' },
                  { id: 'p-hideout-mod-hall-of-fame', label: 'Уголок боевой славы', path: '/eft/progress/hideout/modules/hall-of-fame', iconUrl: '/icons/eft/04-progression/hideout-modules/hall_of_fame.svg' },
                  { id: 'p-hideout-mod-scav-case', label: 'Ящик диких', path: '/eft/progress/hideout/modules/scav-case', iconUrl: '/icons/eft/04-progression/hideout-modules/scav_case.svg' },
                ]
              },
              { id: 'p-hideout-craft', label: 'Прибыль убежища', path: '/eft/progress/hideout/craft-profit', iconUrl: '/icons/eft/04-progression/craft-profit.svg' },
              { id: 'p-hideout-btc', label: 'Прибыль Bitcoin', path: '/eft/progress/hideout/bitcoin-profit', iconUrl: '/icons/eft/04-progression/bitcoin-profit.svg' }
            ]
          },
          {
            id: 'p-barter',
            label: 'Прибыль бартера',
            path: '/eft/progress/barter',
            iconUrl: '/icons/eft/04-progression/barter-profit.svg',
            children: [
              { id: 'p-barter-valuables', label: 'Ценности', path: '/eft/progress/barter/valuables', iconUrl: '/icons/eft/04-progression/barter-profit/valuables.svg' },
              { id: 'p-barter-electronics', label: 'Электроника', path: '/eft/progress/barter/electronics', iconUrl: '/icons/eft/04-progression/barter-profit/electronics.svg' },
              { id: 'p-barter-tools', label: 'Инструменты', path: '/eft/progress/barter/tools', iconUrl: '/icons/eft/04-progression/barter-profit/tools.svg' },
              { id: 'p-barter-flammable', label: 'Г.С.М.', path: '/eft/progress/barter/flammable-materials', iconUrl: '/icons/eft/04-progression/barter-profit/flammable-materials.svg' },
              { id: 'p-barter-building', label: 'Стройматериалы', path: '/eft/progress/barter/building-materials', iconUrl: '/icons/eft/04-progression/barter-profit/building-materials.svg' },
              { id: 'p-barter-household', label: 'Хозтовары', path: '/eft/progress/barter/household-materials', iconUrl: '/icons/eft/04-progression/barter-profit/household-materials.svg' },
              { id: 'p-barter-medical', label: 'Медматериалы', path: '/eft/progress/barter/medical-supplies', iconUrl: '/icons/eft/04-progression/barter-profit/medical-supplies.svg' },
              { id: 'p-barter-energy', label: 'Элементы питания', path: '/eft/progress/barter/energy-elements', iconUrl: '/icons/eft/04-progression/barter-profit/energy-elements.svg' },
              { id: 'p-barter-others', label: 'Другие', path: '/eft/progress/barter/others', iconUrl: '/icons/eft/04-progression/barter-profit/others.svg' }
            ]
          },
          {
            id: 'p-loadouts',
            label: 'Сборки оружия',
            path: '/eft/progress/loadouts',
            iconUrl: '/icons/eft/04-progression/gun-loadouts.svg',
            children: [
              { id: 'p-loadouts-my', label: 'Мои сборки', path: '/eft/progress/loadouts/my', iconUrl: '/icons/eft/04-progression/gun-loadouts/my-gun-loadouts.svg' },
              { id: 'p-loadouts-find', label: 'Найти сборку', path: '/eft/progress/loadouts/find', iconUrl: '/icons/eft/04-progression/gun-loadouts/find-gun-loadout.svg' },
              { id: 'p-loadouts-add', label: 'Создать сборку', path: '/eft/progress/loadouts/add', iconUrl: '/icons/eft/04-progression/gun-loadouts/add-gun-loadout.svg' }
            ]
          },
          { id: 'p-tracker', label: 'Трекер предметов', path: '/eft/progress/tracker', iconUrl: '/icons/eft/04-progression/items-tracker.svg' },
          { id: 'p-needed', label: 'Нужные предметы', path: '/eft/progress/needed', iconUrl: '/icons/eft/04-progression/items-needed.svg' },
          { id: 'p-questmap', label: 'Карта заданий', path: '/eft/questmap', iconUrl: '/icons/eft/04-progression/quest-map.svg' }
        ]
      },
      { 
        id: 'gamesetting', 
        label: 'Кодекс', 
        path: '/eft/gamesetting',
        iconUrl: '/icons/eft/codex-icon.svg',
        children: [
          { id: 'gs-lore', label: 'История мира', path: '/eft/gamesetting/lore', iconUrl: '/icons/eft/05-gamesetting/tarkov-lore.svg' },
          { id: 'gs-timeline', label: 'Хронология', path: '/eft/gamesetting/timeline', iconUrl: '/icons/eft/05-gamesetting/timeline.svg' },
          { 
            id: 'gs-characters', 
            label: 'Персонажи', 
            path: '/eft/gamesetting/characters', 
            iconUrl: '/icons/eft/05-gamesetting/characters.svg',
            children: [
              { id: 'gs-bosses', label: 'Боссы', path: '/eft/gamesetting/bosses', iconUrl: '/icons/eft/05-gamesetting/bosses.svg' },
              { id: 'gs-traders', label: 'Торговцы', path: '/eft/gamesetting/traders', iconUrl: '/icons/eft/05-gamesetting/traders.svg' }
            ]
          },
          { id: 'gs-factions', label: 'Фракции', path: '/eft/gamesetting/factions', iconUrl: '/icons/eft/05-gamesetting/fractions.svg' },
          { id: 'gs-corporations', label: 'Корпорации', path: '/eft/gamesetting/corporations', iconUrl: '/icons/eft/05-gamesetting/corporations.svg' },
          { id: 'gs-locations', label: 'Локации', path: '/eft/gamesetting/locations', iconUrl: '/icons/eft/05-gamesetting/locations.svg' },
          { 
            id: 'gs-materials', 
            label: 'Материалы', 
            path: '/eft/gamesetting/materials',
            iconUrl: '/icons/eft/05-gamesetting/docs-notes.svg',
            children: [
              { id: 'gs-audio', label: 'Аудиозаписи', path: '/eft/gamesetting/audiotapes', iconUrl: '/icons/eft/05-gamesetting/audiotapes.svg' },
              { id: 'gs-docs', label: 'Документы и записки', path: '/eft/gamesetting/docs-notes', iconUrl: '/icons/eft/05-gamesetting/docs-notes.svg' }
            ]
          },
          { id: 'gs-theories', label: 'Теории и загадки', path: '/eft/gamesetting/theories', iconUrl: '/icons/eft/05-gamesetting/theory-riddles.svg' }
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