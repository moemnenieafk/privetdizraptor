import type { ItemProperties } from './ItemModules';

// ─── Категория: type → { label, iconClass } ─────────────────────────────────
// Лейблы из BreadcrumbsSetter.TYPE_CATEGORY_MAP, icon-классы из src/styles/icons.css.
// Порядок важен: более специфичные типы раньше (helmet до wearable и т.д.).

interface CategoryInfo {
  label: string;
  iconClass: string;
  href: string;
}

// Лейблы/href из BreadcrumbsSetter.TYPE_CATEGORY_MAP, icon-классы из src/styles/icons.css
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
  ['barter',     { label: 'Бартер',         iconClass: 'icon-eft-items-equipment', href: '/eft/items/barter' }],
];

export function getItemCategory(types: string[]): CategoryInfo | null {
  for (const [type, info] of CATEGORY_BY_TYPE) {
    if (types.includes(type)) return info;
  }
  return null;
}

// ─── Ключевой опознавательный стат по типу properties ───────────────────────

interface HeadlineItem {
  properties: ItemProperties;
  weight?: number;
}

const cleanCaliber = (caliber: string | null): string => (caliber ?? '').replace('Caliber', '');

export function getItemHeadline({ properties: p, weight }: HeadlineItem): string | null {
  if (p) {
    // Оружие — калибр (recoilVertical уникален для оружия)
    if ('recoilVertical' in p) {
      const cal = cleanCaliber(p.caliber);
      if (cal) return cal;
    }
    // Патрон — калибр + пробитие
    else if ('penetrationPower' in p) {
      const cal = cleanCaliber(p.caliber);
      const pen = p.penetrationPower;
      return [cal, pen != null ? `${pen} проб.` : null].filter(Boolean).join(' · ') || null;
    }
    // Граната — тип
    else if ('fuse' in p) {
      if (p.type) return p.type;
    }
    // Броня / шлем — класс + материал
    else if ('class' in p) {
      return `Класс ${p.class}${p.material?.name ? ` · ${p.material.name}` : ''}`;
    }
    // Контейнер / рюкзак — вместимость в слотах
    else if ('grids' in p) {
      const slots = p.grids.reduce((acc, g) => acc + g.width * g.height, 0);
      if (slots > 0) return `${slots} слотов`;
    }
    // Аптечка — HP
    else if ('hitpoints' in p) {
      return `${p.hitpoints} HP`;
    }
    // Медпредмет — использования
    else if ('uses' in p) {
      if (p.uses != null) return `${p.uses} исп.`;
    }
    // Наушники — прибавка к слуху
    else if ('distanceModifier' in p) {
      if (p.distanceModifier != null) return `+${Math.round((p.distanceModifier - 1) * 100)}% слух`;
    }
  }

  return weight != null ? `${weight} кг` : null;
}
