/**
 * Под-категории маркеров для редактора карт. loot/container — переключаемые наборы.
 * loot переиспользует иконки таксономии сайта (icon-eft-*, см. src/lib/item-category.ts + icons.css);
 * container — текстом (своих иконок в EFT-таксономии нет). spawn — фракции/типы ботов.
 */
export interface MarkerCategory {
  key: string;
  label: string;
  /** CSS icon-mask класс (icon-eft-*) — только для loot. */
  icon?: string;
}
export interface CategoryGroup {
  group: string;
  items: MarkerCategory[];
}

// СПАВН — фракции/типы (мелким шрифтом в селекторе).
export const SPAWN_CATEGORIES: MarkerCategory[] = [
  { key: 'pmc', label: 'ЧВК' },
  { key: 'scav', label: 'Дикий' },
  { key: 'boss', label: 'Босс' },
  { key: 'escort', label: 'Свита' },
  { key: 'blackdiv', label: 'Black Division' },
  { key: 'goons', label: 'Goons' },
  { key: 'cultist', label: 'Сектанты' },
  { key: 'rogue', label: 'Отступники' },
  { key: 'smuggler', label: 'Контрабандисты' },
  { key: 'cleanup', label: 'Команда зачистки' },
  { key: 'sniper', label: 'Снайпер' },
  { key: 'raider', label: 'Налётчики' },
];

// ЛУТ — таксономия предметов сайта (иконки реальные, из icons.css).
export const LOOT_CATEGORIES: CategoryGroup[] = [
  {
    group: 'Бартер',
    items: [
      { key: 'barter-others', label: 'Другие', icon: 'icon-eft-barter-others' },
      { key: 'barter-flammable', label: 'Г.С.М.', icon: 'icon-eft-barter-flammable' },
      { key: 'barter-tools', label: 'Инструменты', icon: 'icon-eft-barter-tools' },
      { key: 'barter-electronics', label: 'Электроника', icon: 'icon-eft-barter-electronics' },
      { key: 'barter-materials', label: 'Стройматериалы', icon: 'icon-eft-barter-materials' },
      { key: 'barter-household', label: 'Хозтовары', icon: 'icon-eft-barter-household' },
      { key: 'barter-valuables', label: 'Ценности', icon: 'icon-eft-barter-valuables' },
      { key: 'barter-medical', label: 'Медматериалы', icon: 'icon-eft-barter-medical' },
      { key: 'barter-energy', label: 'Элементы питания', icon: 'icon-eft-barter-energy' },
    ],
  },
  {
    group: 'Провизия',
    items: [
      { key: 'food', label: 'Еда', icon: 'icon-eft-eq-food' },
      { key: 'drinks', label: 'Напитки', icon: 'icon-eft-eq-drinks' },
    ],
  },
  {
    group: 'Ключи',
    items: [
      { key: 'keycards', label: 'Ключ-карты', icon: 'icon-eft-eq-keycards' },
      { key: 'mechkeys', label: 'Механические', icon: 'icon-eft-eq-mechkeys' },
      { key: 'markedkeys', label: 'Меченые', icon: 'icon-eft-eq-markedkeys' },
      { key: 'questkeys', label: 'Для заданий', icon: 'icon-eft-eq-questkeys' },
    ],
  },
  {
    group: 'Прочее',
    items: [{ key: 'infoitems', label: 'Инфо-предметы', icon: 'icon-eft-eq-infoitems' }],
  },
  {
    group: 'Медикаменты',
    items: [
      { key: 'medkits', label: 'Аптечки', icon: 'icon-eft-eq-medkits' },
      { key: 'injectors', label: 'Инъекторы', icon: 'icon-eft-eq-injectors' },
      { key: 'injury', label: 'Обработка ранений', icon: 'icon-eft-eq-injury' },
      { key: 'pills', label: 'Таблетки', icon: 'icon-eft-eq-pills' },
    ],
  },
  {
    group: 'Боеприпасы',
    items: [
      { key: 'ammo', label: 'Патроны', icon: 'icon-eft-guns-ammo' },
      { key: 'ammo-package', label: 'Пачки', icon: 'icon-eft-cat-ammo-package' },
    ],
  },
  {
    group: 'Оружие',
    items: [
      { key: 'guns', label: 'Оружие', icon: 'icon-eft-items-guns' },
      { key: 'knifes', label: 'Холодное', icon: 'icon-eft-guns-knifes' },
      { key: 'grenades', label: 'Гранаты', icon: 'icon-eft-guns-grenades' },
      { key: 'gunmods', label: 'Моды', icon: 'icon-eft-guns-mods' },
      { key: 'special-weapon', label: 'Спец.', icon: 'icon-eft-guns-special' },
    ],
  },
  {
    group: 'Снаряжение',
    items: [
      { key: 'helmets', label: 'Шлемы', icon: 'icon-eft-gear-helmets' },
      { key: 'armor', label: 'Броня', icon: 'icon-eft-gear-armor' },
      { key: 'rigs', label: 'Разгрузки', icon: 'icon-eft-gear-rigs' },
      { key: 'backpacks', label: 'Рюкзаки', icon: 'icon-eft-gear-backpacks' },
      { key: 'headphones', label: 'Наушники', icon: 'icon-eft-gear-headphones' },
      { key: 'masks', label: 'Маски', icon: 'icon-eft-gear-masks' },
      { key: 'visors', label: 'Очки/визоры', icon: 'icon-eft-gear-visors' },
      { key: 'gear-comps', label: 'Компоненты', icon: 'icon-eft-gear-comps' },
      { key: 'cases', label: 'Кейсы', icon: 'icon-eft-eq-cases' },
      { key: 'secure', label: 'Защищённые', icon: 'icon-eft-eq-secure' },
    ],
  },
];

// КОНТЕЙНЕРЫ — статичные точки лута / трупы / схроны EFT (текст; своих иконок нет).
export const CONTAINER_CATEGORIES: CategoryGroup[] = [
  {
    group: 'Статичные',
    items: [
      { key: 'weapon-case', label: 'Оружейный кейс' },
      { key: 'weapon-box', label: 'Оружейный ящик' },
      { key: 'wooden-crate', label: 'Деревянный ящик' },
      { key: 'ammo-box', label: 'Патронный ящик' },
      { key: 'grenade-box', label: 'Гранатный ящик' },
      { key: 'cash-register', label: 'Кассовый аппарат' },
      { key: 'safe', label: 'Сейф' },
      { key: 'jacket', label: 'Куртка' },
      { key: 'medbag', label: 'Медсумка' },
      { key: 'medcase', label: 'Медукладка' },
      { key: 'toolbox', label: 'Ящик с инструментами' },
      { key: 'filing-cabinet', label: 'Картотека' },
      { key: 'drawer', label: 'Ящик стола' },
      { key: 'pc-block', label: 'ПК-блок' },
      { key: 'duffle-bag', label: 'Спортивная сумка' },
      { key: 'tech-crate', label: 'Технический ящик' },
      { key: 'med-crate', label: 'Медицинский ящик' },
      { key: 'ration-crate', label: 'Стеллаж с провизией' },
      { key: 'suitcase', label: 'Пластиковый кейс' },
      { key: 'fridge', label: 'Холодильник' },
      { key: 'locker', label: 'Шкаф/локер' },
      { key: 'bank', label: 'Касса/сейф банка' },
      { key: 'airdrop', label: 'Аирдроп-сброс' },
    ],
  },
  {
    group: 'Трупы',
    items: [
      { key: 'corpse-pmc', label: 'Труп ЧВК' },
      { key: 'corpse-scav', label: 'Труп дикого' },
      { key: 'corpse-civ', label: 'Труп гражданского' },
      { key: 'corpse-boss', label: 'Труп босса' },
    ],
  },
  {
    group: 'Схроны',
    items: [
      { key: 'buried-barrel', label: 'Закопанные бочки' },
      { key: 'ground-cache', label: 'Схрон в земле' },
      { key: 'stash', label: 'Тайник' },
    ],
  },
];

/** Дефолтная категория для типа (первый элемент списка) — '' для типов без категорий. */
export function defaultCategory(type: string): string {
  if (type === 'spawn') return SPAWN_CATEGORIES[0].key;
  if (type === 'loot') return LOOT_CATEGORIES[0].items[0].key;
  if (type === 'container') return CONTAINER_CATEGORIES[0].items[0].key;
  return '';
}

/** Лейбл категории по ключу (для подписи/тултипа). */
export function categoryLabel(key: string): string | undefined {
  const all = [
    ...SPAWN_CATEGORIES,
    ...LOOT_CATEGORIES.flatMap((g) => g.items),
    ...CONTAINER_CATEGORIES.flatMap((g) => g.items),
  ];
  return all.find((c) => c.key === key)?.label;
}
