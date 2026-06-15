'use client';

import { useEffect } from 'react';
import { useBreadcrumbStore, type BreadcrumbItem } from '@/store/useBreadcrumbStore';

// Priority order: more specific types come first so helmets don't resolve as 'wearable'
const TYPE_PRIORITY = [
  'helmet', 'armor', 'armorPlate', 'backpack', 'rig', 'glasses',
  'headphones', 'wearable', 'container', 'gun', 'grenade',
  'injectors', 'meds', 'ammo', 'mods', 'keys', 'provisions', 'barter',
];

interface CategoryEntry {
  parent?: { label: string; href: string };
  category: { label: string; href: string };
}

const TYPE_CATEGORY_MAP: Record<string, CategoryEntry> = {
  helmet:     { parent: { label: 'Снаряжение', href: '/eft/items/gear' }, category: { label: 'Шлемы',           href: '/eft/items/gear/helmets'    } },
  armor:      { parent: { label: 'Снаряжение', href: '/eft/items/gear' }, category: { label: 'Бронежилеты',    href: '/eft/items/gear/armor'      } },
  armorPlate: { parent: { label: 'Снаряжение', href: '/eft/items/gear' }, category: { label: 'Компоненты',     href: '/eft/items/gear/components' } },
  backpack:   { parent: { label: 'Снаряжение', href: '/eft/items/gear' }, category: { label: 'Рюкзаки',        href: '/eft/items/gear/backpacks'  } },
  rig:        { parent: { label: 'Снаряжение', href: '/eft/items/gear' }, category: { label: 'Разгрузки',      href: '/eft/items/gear/rigs'       } },
  glasses:    { parent: { label: 'Снаряжение', href: '/eft/items/gear' }, category: { label: 'Очки и Визоры',  href: '/eft/items/gear/glasses'    } },
  headphones: { parent: { label: 'Снаряжение', href: '/eft/items/gear' }, category: { label: 'Наушники',       href: '/eft/items/gear/headphones' } },
  wearable:   { parent: { label: 'Снаряжение', href: '/eft/items/gear' }, category: { label: 'Маски',          href: '/eft/items/gear/masks'      } },
  container:  { parent: { label: 'Снаряжение', href: '/eft/items/gear' }, category: { label: 'Контейнеры',     href: '/eft/items/gear/containers' } },
  gun:        {                                                             category: { label: 'Оружие',         href: '/eft/items/weapons'         } },
  grenade:    {                                                             category: { label: 'Гранаты',        href: '/eft/items/weapons/grenades'} },
  mods:       {                                                             category: { label: 'Моды',           href: '/eft/items/mods'            } },
  ammo:       {                                                             category: { label: 'Боеприпасы',     href: '/eft/items/ammo'            } },
  injectors:  { parent: { label: 'Медикаменты', href: '/eft/items/meds' }, category: { label: 'Инъекторы',     href: '/eft/items/meds/injectors'  } },
  meds:       {                                                             category: { label: 'Медикаменты',    href: '/eft/items/meds'            } },
  keys:       {                                                             category: { label: 'Ключи',          href: '/eft/items/keys'            } },
  provisions: {                                                             category: { label: 'Провизия',       href: '/eft/items/provisions'      } },
  barter:     {                                                             category: { label: 'Бартер',         href: '/eft/items/barter'          } },
};

interface BreadcrumbsSetterProps {
  name: string;
  types: string[];
}

export function BreadcrumbsSetter({ name, types }: BreadcrumbsSetterProps) {
  const setDynamicCrumbs = useBreadcrumbStore((s) => s.setDynamicCrumbs);
  const clearDynamicCrumbs = useBreadcrumbStore((s) => s.clearDynamicCrumbs);

  useEffect(() => {
    const matchedType = TYPE_PRIORITY.find((t) => types.includes(t) && TYPE_CATEGORY_MAP[t]);
    const crumbs: BreadcrumbItem[] = [];

    if (matchedType) {
      const entry = TYPE_CATEGORY_MAP[matchedType];
      if (entry.parent) crumbs.push(entry.parent);
      crumbs.push(entry.category);
    }

    crumbs.push({ label: name });
    setDynamicCrumbs(crumbs);

    return () => clearDynamicCrumbs();
  }, [name, types, setDynamicCrumbs, clearDynamicCrumbs]);

  return null;
}
