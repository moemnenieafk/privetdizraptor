export interface MenuItem {
  label: string;
  path: string;
}

export interface HeaderConfig {
  searchPlaceholder: string;
  menuItems: MenuItem[];
  currencySymbol: string;
}

export const HEADER_DICTIONARY: Record<string, HeaderConfig> = {
  eft: {
    searchPlaceholder: 'ГЛОБАЛЬНЫЙ ТАКТИЧЕСКИЙ ПОИСК...',
    menuItems: [
      { label: 'Карты', path: '/eft/maps' },
      { label: 'Квесты', path: '/eft/quests' },
      { label: 'Патроны', path: '/eft/ammo' },
      { label: 'Убежище', path: '/eft/hideout' },
      { label: 'Трекер', path: '/eft/tracker' },
      { label: 'Крафты', path: '/eft/crafts' },
      { label: 'Бартеры', path: '/eft/barters' },
    ],
    currencySymbol: '₽',
  },
  frago: {
    searchPlaceholder: 'ПОИСК ПО БАЗЕ ДАННЫХ СЕКТОРОВ...',
    menuItems: [
      { label: 'Секторы', path: '/frago/sectors' },
      { label: 'Миссии', path: '/frago/missions' },
      { label: 'Вооружение', path: '/frago/weapons' },
      { label: 'Чертежи', path: '/frago/blueprints' },
      { label: 'Модули', path: '/frago/modules' },
    ],
    currencySymbol: 'Кр.',
  },
  abi: {
    searchPlaceholder: 'ПОИСК ТАКТИЧЕСКОЙ ЭКИПИРОВКИ...',
    menuItems: [
      { label: 'Карты', path: '/abi/maps' },
      { label: 'Операции', path: '/abi/operations' },
      { label: 'Снаряжение', path: '/abi/gear' },
      { label: 'Оружие', path: '/abi/weapons' },
      { label: 'Рынок', path: '/abi/market' },
    ],
    currencySymbol: 'Koen',
  },
  gzw: {
    searchPlaceholder: 'ПОИСК ДАННЫХ РАЗВЕДКИ...',
    menuItems: [
      { label: 'Зоны', path: '/gzw/zones' },
      { label: 'Контракты', path: '/gzw/contracts' },
      { label: 'Арсенал', path: '/gzw/arsenal' },
      { label: 'Схроны', path: '/gzw/stashes' },
      { label: 'Фракции', path: '/gzw/factions' },
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