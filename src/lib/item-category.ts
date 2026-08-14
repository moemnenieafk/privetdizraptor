// Категория предмета по его types[] — единый источник истины для лейбла и иконки
// (используется детальной страницей предмета и карточкой глобального поиска).
// iconClass = CSS-маска класс из src/styles/icons.css.
// Порядок важен: более специфичные типы раньше (helmet до wearable и т.д.).
import { BP_SEASON_1_DOC_IDS } from '@/data/eft-season-items';

export interface CategoryInfo {
  label: string;
  iconClass: string;
  href: string;
}

const CATEGORY_BY_TYPE: Array<[type: string, info: CategoryInfo]> = [
  ['helmet',     { label: 'Шлемы',          iconClass: 'icon-eft-gear-helmets',    href: '/eft/items/gear/helmets' }],
  ['armor',      { label: 'Бронежилеты',    iconClass: 'icon-eft-gear-armor',      href: '/eft/items/gear/armor' }],
  ['armorPlate', { label: 'Компоненты',     iconClass: 'icon-eft-gear-comps',      href: '/eft/items/gear/components' }],
  ['backpack',   { label: 'Рюкзаки',        iconClass: 'icon-eft-gear-backpacks',  href: '/eft/items/gear/backpacks' }],
  ['rig',        { label: 'Разгрузки',      iconClass: 'icon-eft-gear-rigs',       href: '/eft/items/gear/rigs' }],
  ['glasses',    { label: 'Очки и Визоры',  iconClass: 'icon-eft-gear-visors',     href: '/eft/items/gear/glasses' }],
  ['headphones', { label: 'Наушники',       iconClass: 'icon-eft-gear-headphones', href: '/eft/items/gear/headphones' }],
  ['wearable',   { label: 'Маски',          iconClass: 'icon-eft-gear-masks',      href: '/eft/items/gear/masks' }],
  ['container',  { label: 'Контейнеры',     iconClass: 'icon-eft-eq-containers',   href: '/eft/items/gear/containers' }],
  ['gun',        { label: 'Оружие',         iconClass: 'icon-eft-items-guns',      href: '/eft/items/weapons' }],
  ['grenade',    { label: 'Гранаты',        iconClass: 'icon-eft-guns-grenades',   href: '/eft/items/weapons/grenades' }],
  ['injectors',  { label: 'Инъекторы',      iconClass: 'icon-eft-eq-injectors',    href: '/eft/items/meds/injectors' }],
  ['meds',       { label: 'Медикаменты',    iconClass: 'icon-eft-eq-meds',         href: '/eft/items/meds' }],
  ['ammo',       { label: 'Боеприпасы',     iconClass: 'icon-eft-guns-ammo',       href: '/eft/items/ammo' }],
  ['mods',       { label: 'Моды',           iconClass: 'icon-eft-guns-mods',       href: '/eft/items/mods' }],
  ['keys',       { label: 'Ключи',          iconClass: 'icon-eft-eq-keys',         href: '/eft/items/keys' }],
  ['provisions', { label: 'Провизия',       iconClass: 'icon-eft-eq-provisions',   href: '/eft/items/provisions' }],
  ['barter',     { label: 'Предметы для бартера', iconClass: 'icon-eft-items-equipment', href: '/eft/items/barter' }],
];

// Сезонная категория БП — оверрайд по id: документы имеют types=['noFlea'], по типу не отличить.
const BATTLEPASS_S1_CATEGORY: CategoryInfo = {
  label: 'BATTLEPASS - S1',
  iconClass: 'icon-eft-seasons',
  href: '/eft/items/battle-pass',
};

export function getItemCategory(types: string[], id?: string): CategoryInfo | null {
  if (id && BP_SEASON_1_DOC_IDS.has(id)) return BATTLEPASS_S1_CATEGORY;
  for (const [type, info] of CATEGORY_BY_TYPE) {
    if (types.includes(type)) return info;
  }
  return null;
}

// ─── Иконка категории для компактного индикатора (карточка поиска) ───────────
// Бартер — особый случай: все предметы имеют один type='barter', поэтому
// верхнеуровневый резолвер даёт одну generic-иконку. Подкатегорию различаем
// по bsgCategoryId и берём её собственную иконку из barter-profit/*.svg
// (id-категорий — те же, что в src/app/eft/items/[...category]/page.tsx).

const BARTER_DIR = '/icons/eft/04-progression/barter-profit';
const BARTER_ROOT_ICON = '/icons/eft/04-progression/barter-profit.svg';

const BARTER_BSG_ICON: Record<string, string> = {
  '590c745b86f7743cc433c5f2': `${BARTER_DIR}/others.svg`,
  '57864a3d24597754843f8721': `${BARTER_DIR}/valuables.svg`,
  '57864a66245977548f04a81f': `${BARTER_DIR}/electronics.svg`,
  '57864bb7245977548b3b66c2': `${BARTER_DIR}/tools.svg`,
  '57864c322459775490116fbf': `${BARTER_DIR}/household-materials.svg`,
  '57864ada245977548638de91': `${BARTER_DIR}/building-materials.svg`,
  '57864c8c245977548867e7f1': `${BARTER_DIR}/medical-supplies.svg`,
  '57864ee62459775490116fc1': `${BARTER_DIR}/energy-elements.svg`,
  '57864e4c24597754843f8723': `${BARTER_DIR}/flammable-materials.svg`,
  '5d650c3e815116009f6201d2': `${BARTER_DIR}/flammable-materials.svg`,
};

/** Иконка категории как CSS-маска класс ИЛИ прямой URL (для подкатегорий бартера). */
export interface CategoryIcon {
  label: string;
  iconClass?: string;
  iconUrl?: string;
}

export function getCategoryIcon(types: string[], bsgCategoryId?: string, id?: string): CategoryIcon | null {
  const cat = getItemCategory(types, id);
  if (!cat) return null;

  // Барахолка: уточняем подкатегорию по bsgCategoryId, фоллбэк — общая иконка бартера.
  if (cat.href === '/eft/items/barter') {
    return {
      label: cat.label,
      iconUrl: (bsgCategoryId && BARTER_BSG_ICON[bsgCategoryId]) || BARTER_ROOT_ICON,
    };
  }

  return { label: cat.label, iconClass: cat.iconClass };
}
