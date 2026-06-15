export type EyewearSubtype = 'glasses' | 'nvg' | 'visor';

export const EYEWEAR_SUBTYPE_LABELS: Record<EyewearSubtype | 'all', string> = {
  all: 'Все',
  glasses: 'Очки',
  nvg: 'ПНВ / Тепловизор',
  visor: 'Визор',
};

interface EyewearItem {
  types?: string[];
  name?: string;
  properties?: { armorType?: string | null; nvgIntensity?: number | null } | null;
}

export function getEyewearSubtype(item: EyewearItem): EyewearSubtype | null {
  // Визоры — по имени (независимо от типа API)
  if (/визор/i.test(item.name ?? '')) return 'visor';
  // ПНВ по имени или по свойству nvgIntensity (glasses и mods оба попадают)
  if (/прибор ночного видения/i.test(item.name ?? '')) return 'nvg';
  if (item.properties?.nvgIntensity != null) return 'nvg';
  if (item.types?.includes('glasses')) return 'glasses';
  return null;
}
