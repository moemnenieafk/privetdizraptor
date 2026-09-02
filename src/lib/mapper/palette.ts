// cta-mapper — материальная палитра карт (V4DYA, 2026-08-13; +gravel-sand для Леса 2026-09-02) и логика сабсета.
// Перенесено в main из feat/cta-mapper как единый источник палитры (грилл woods-asset-epic).
//
// Решение 4b: каждый материал = DEFAULT + SHADOW (в тени) + HIGHLIGHT (на солнце) —
// цветной cel-shading. Промт S6 даёт модели ОДНУ триаду по материалу, не список из 60.
//
// OKLab-замер (см. спеку, «OKLab-замер — выводы»): близких межсемейных пар много (28 < 0.040),
// поэтому объект трассируется ТОЛЬКО против сабсета своих материалов + нейтрали + матовый —
// не против всех 60, иначе snap уводит цвет в чужое семейство. Тени контейнеров углублены
// после замера (триады SH→DEF выросли до 0.18–0.29).

import type { MaterialFamily, Matte } from './types';

/** 21 семейство × shadow/default/highlight = 63 цвета. Единый кросс-карточный канон (Завод, Таможня, Лес). */
export const FACTORY_PALETTE: MaterialFamily[] = [
  { id: 'mach-yellow', usage: 'Yellow Machinery', shadow: '#805D2C', default: '#BF9731', highlight: '#D5B775' },
  { id: 'foliage', usage: 'Tree Canopy, Foliage, Spruce, Pine', shadow: '#1D3F2F', default: '#4F8953', highlight: '#B0B560' },
  { id: 'concrete', usage: 'Concrete Structures', shadow: '#3F3F3F', default: '#777777', highlight: '#A1A1A1' },
  { id: 'veh-khaki', usage: 'Khaki Military Vehicles', shadow: '#2E2F20', default: '#535539', highlight: '#747754' },
  { id: 'swamp', usage: 'Swamp Terrain', shadow: '#1C1B14', default: '#333121', highlight: '#585541' },
  { id: 'plastic-white', usage: 'White Plastic', shadow: '#4B4742', default: '#A1998F', highlight: '#CCC3B9' },
  // тень углублена #284559 → #102737 (OKLab: SH→DEF 0.070 → 0.185)
  { id: 'cnt-blue', usage: 'Blue Metal Containers', shadow: '#102737', default: '#3C586D', highlight: '#719AB8' },
  { id: 'dirt', usage: 'Dirt Path, Trampled Ground', shadow: '#342D27', default: '#605248', highlight: '#7D6B5E' },
  { id: 'toxin', usage: 'Toxins', shadow: '#3C5800', default: '#96D42B', highlight: '#D7FF77' },
  // тень углублена #5C2E29 → #33130F (OKLab: SH→DEF 0.088 → 0.211)
  { id: 'cnt-red', usage: 'Red Metal Containers', shadow: '#33130F', default: '#84362E', highlight: '#BD7972' },
  { id: 'rust', usage: 'Rust', shadow: '#352219', default: '#82543E', highlight: '#C18C6D' },
  { id: 'mach-orange', usage: 'Orange Machinery', shadow: '#6E3C22', default: '#BC6336', highlight: '#F49B63' },
  { id: 'water', usage: 'Water, River, Sea, Lake', shadow: '#184148', default: '#386E5B', highlight: '#6D9C9C' },
  { id: 'rubber', usage: 'Rubber, Plastic, Black Platform', shadow: '#0D0D0E', default: '#202025', highlight: '#4B4B50' },
  { id: 'veh-green', usage: 'Green Military Vehicles', shadow: '#37452E', default: '#536744', highlight: '#769162' },
  { id: 'soil', usage: 'Soil, Ground, Grass', shadow: '#1E2617', default: '#415232', highlight: '#5F784A' },
  { id: 'wood', usage: 'Wooden Objects, Items', shadow: '#4C3C2F', default: '#A18265', highlight: '#D2B18A' },
  // тень углублена #4A482A → #272D0A (OKLab: SH→DEF 0.148 → 0.293)
  { id: 'cnt-green', usage: 'Green Metal Containers', shadow: '#272D0A', default: '#807B3F', highlight: '#B4BD72' },
  { id: 'rock', usage: 'Rocks, Boulders, Bedrock', shadow: '#383A43', default: '#565967', highlight: '#6F7485' },
  // Лес (грилл 2026-09-02): гравий/песок карьера и берега — от Shebuka-песка #928E73
  { id: 'gravel-sand', usage: 'Gravel, Sand, Scree, Quarry Floor', shadow: '#5E5A47', default: '#928E73', highlight: '#BFB99A' },
  { id: 'fire', usage: 'Fire, Blaze, Combustion', shadow: '#494B69', default: '#E56F25', highlight: '#F9F7A3' },
];

export const MATTE_HEX: Record<Matte, string> = { magenta: '#C000C0', green: '#00C000' };

/** Самый тёмный цвет реестра — контур объекта (V0 в терминах ручного пайплайна). */
export const OUTLINE_HEX = '#0D0D0E';

/** Нейтрали, что подмешиваются почти в каждый сабсет (бетон + резина-контур). */
export const NEUTRAL_IDS = ['concrete', 'rubber'] as const;

/**
 * Семейства, которые НЕ должны попасть в один сабсет без предупреждения гейта.
 * Из OKLab-замера: внутри группы пары сидят в 0.023–0.040 → snap их слипнёт.
 */
export const COLLISION_GROUPS: string[][] = [
  ['veh-khaki', 'swamp', 'dirt', 'soil', 'veh-green', 'cnt-green', 'gravel-sand'], // тёмно-зелёные/бурые (+gravel-sand: OKLab до swamp 0.019, dirt 0.026)
  ['concrete', 'plastic-white', 'rubber', 'wood'], // нейтрали
];

const BY_ID = new Map(FACTORY_PALETTE.map((f) => [f.id, f]));

export function familyById(id: string): MaterialFamily | undefined {
  return BY_ID.get(id);
}

/** Все 60 хексов плоским списком (верхний регистр). */
export function allHexes(palette: MaterialFamily[] = FACTORY_PALETTE): string[] {
  return palette.flatMap((f) => [f.shadow, f.default, f.highlight]).map((h) => h.toUpperCase());
}

/** Хекс → имя токена-слоя Figma, напр. '#3C586D' → 'cnt-blue', '#102737' → 'cnt-blue-sh'. */
export function tokenFor(hex: string, palette: MaterialFamily[] = FACTORY_PALETTE): string | null {
  const H = hex.toUpperCase();
  for (const f of palette) {
    if (f.default.toUpperCase() === H) return f.id;
    if (f.shadow.toUpperCase() === H) return `${f.id}-sh`;
    if (f.highlight.toUpperCase() === H) return `${f.id}-hi`;
  }
  if (H === MATTE_HEX.magenta.toUpperCase() || H === MATTE_HEX.green.toUpperCase()) return 'matte';
  return null;
}

/**
 * Палитра трассировки для ОДНОГО объекта (решение 4b + OKLab):
 * триады перечисленных материалов + нейтрали + контур + матовый. Никогда не все 60.
 */
export function tracePalette(
  materialIds: string[],
  matte: Matte,
  palette: MaterialFamily[] = FACTORY_PALETTE,
): string[] {
  const ids = new Set<string>([...materialIds, ...NEUTRAL_IDS]);
  const out = new Set<string>();
  for (const id of ids) {
    const f = palette.find((x) => x.id === id);
    if (f) [f.shadow, f.default, f.highlight].forEach((h) => out.add(h.toUpperCase()));
  }
  out.add(OUTLINE_HEX.toUpperCase());
  out.add(MATTE_HEX[matte].toUpperCase());
  return [...out];
}

/** Предупреждения гейта: какие близкие семейства попали в один сабсет. */
export function collisionWarnings(materialIds: string[]): string[] {
  const present = new Set(materialIds);
  const warns: string[] = [];
  for (const group of COLLISION_GROUPS) {
    const hit = group.filter((id) => present.has(id));
    if (hit.length >= 2) warns.push(`Близкие семейства в одном сабсете (могут слиться при snap): ${hit.join(', ')}`);
  }
  return warns;
}
