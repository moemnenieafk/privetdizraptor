import type { ItemProperties } from './ItemModules';

// Категория предмета вынесена в общий модуль (переиспользуется глобальным поиском).
export { getItemCategory, type CategoryInfo } from '@/lib/item-category';

// ─── Ключевой опознавательный стат по типу properties ───────────────────────

interface HeadlineItem {
  properties: ItemProperties;
}

const cleanCaliber = (caliber: string | null): string => (caliber ?? '').replace('Caliber', '');

export function getItemHeadline({ properties: p }: HeadlineItem): string | null {
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

  return null;
}
