import type { EftTopStat } from '@/components/features/items/EftItemTile/types';

// ─── Minimal item shape needed for indicator logic ─────────────────────────────

export interface IndicatorItem {
  types?: string[];
  name?: string | null;
  weight?: number | null;
  grids?: Array<{ width: number; height: number }> | null;
  properties?: {
    // Armor / Helmet / Rig / Glasses
    class?: number | null;
    durability?: number | null;
    capacity?: number | null;
    // Headphone
    ambientVolume?: number | null;
    distanceModifier?: number | null;
    compressorTreshold?: number | null; // typo is from game data — intentional
    distortion?: number | null;
    // Weapon mod
    ergonomics?: number | null;
    recoilModifier?: number | null;
    // ItemPropertiesMedKit
    hitpoints?: number | null;
    // ItemPropertiesMedicalItem (pills, injectors, injury treatment)
    uses?: number | null;
    useTime?: number | null;
    // Keys
    maxUses?: number | null;
  } | null;
}

// ─── Category slug sets ────────────────────────────────────────────────────────

const ARMORED_SLUGS = new Set(['armor', 'helmets', 'components', 'eyewear', 'facecovers']);
const BACKPACK_SLUGS = new Set(['backpacks']);
const RIG_SLUGS = new Set(['rigs']);
const CONTAINER_SLUGS = new Set(['cases', 'secure', 'storage-containers', 'secure-containers']);
const HEADPHONE_SLUGS = new Set(['headphones']);
const AMMO_SLUGS = new Set(['ammo', 'rounds', 'ammo-boxes']);
const GUN_SLUGS = new Set(['weapons', 'firearms', 'ar', 'bolt', 'carbine', 'dmr', 'gl', 'lmg', 'shotgun', 'sidearm', 'smg', 'special', 'guns']);
const MELEE_SLUGS = new Set(['melee']);
const GRENADE_SLUGS = new Set(['grenades']);
const MOD_SLUGS = new Set([
  'mods', 'vitalparts', 'functional', 'elements',
  'auxiliary', 'auxiliary-parts',
  'barrels', 'bipods', 'charginghandles', 'foregrips', 'gasblocks',
  'handguards',
  'laser', 'light-laser-devices',
  'launchers',
  'magazines', 'mounts', 'muzzle',
  'pistolgrips',
  'receivers', 'receivers-slides',
  'sights', 'stocks',
]);
const MEDS_SLUGS = new Set(['meds', 'injury', 'injectors', 'medkits', 'pills']);
const PROVISIONS_SLUGS = new Set(['provisions', 'drinks', 'food']);
const KEYS_SLUGS = new Set(['keys', 'mechanical', 'keycards', 'marked', 'quest']);
const BARTER_SLUGS = new Set([
  'barter', 'valuables', 'electronics', 'tools', 'flammable-materials',
  'building-materials', 'household-materials', 'medical-supplies',
  'energy-elements', 'others', 'specialequipment',
]);
const INFO_SLUGS = new Set(['info', 'info-items']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Props = NonNullable<IndicatorItem['properties']>;

function calculateContainerCapacity(item: IndicatorItem): number | null {
  if (!item.grids || item.grids.length === 0) return null;
  const total = item.grids.reduce((sum, g) => sum + g.width * g.height, 0);
  return total > 0 ? total : null;
}

/** Draft formula — calibrate once real hearing attenuation model is documented. */
function calculateHearingRange(p: Props): number {
  const distMod = p.distanceModifier ?? 1;
  const ambient = p.ambientVolume ?? -30;
  const compressor = p.compressorTreshold ?? -40;
  const distortion = p.distortion ?? 0;

  const base = 100 * distMod;
  const ambientBonus = 1 + Math.max(0, -ambient - 30) / 100;
  const distortionPenalty = 1 - Math.min(distortion * 0.5, 0.3);
  const compressorBonus = compressor < -40 ? 1.1 : 1;

  return Math.round(base * ambientBonus * distortionPenalty * compressorBonus);
}

/** Returns whichever of ergonomics / recoil has the greatest positive build impact. */
function getBestModStat(p: Props): string | null {
  const ergo = p.ergonomics ?? 0;
  const recoil = p.recoilModifier ?? 0;
  if (ergo === 0 && recoil === 0) return null;

  // recoilModifier is fractional: -0.04 = -4% recoil (beneficial when negative)
  const recoilBenefit = -recoil * 100;
  const ergoBenefit = ergo;

  if (recoilBenefit > 0 && recoilBenefit > ergoBenefit) {
    return `-${recoilBenefit.toFixed(1).replace(/\.0$/, '')}% ОТД`;
  }
  if (ergoBenefit !== 0) {
    return `${ergoBenefit > 0 ? '+' : ''}${ergoBenefit} ЭРГ`;
  }
  // recoil hurts
  return `+${(recoil * 100).toFixed(1).replace(/\.0$/, '')}% ОТД`;
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export function getDynamicTopIndicator(item: IndicatorItem, slug: string): EftTopStat {
  const p = item.properties ?? {};
  const types = item.types ?? [];

  // Ammo / Ammo Boxes — overlays in media block handle damage/pen visuals
  if (AMMO_SLUGS.has(slug) || types.includes('ammo')) {
    return { kind: 'hidden' };
  }

  // Grenades → weight (type/fuse shown in table columns)
  if (GRENADE_SLUGS.has(slug) || types.includes('grenade')) {
    return item.weight != null ? { kind: 'weight', value: item.weight } : { kind: 'hidden' };
  }

  // Backpacks → slot capacity
  if (BACKPACK_SLUGS.has(slug) || types.includes('backpack')) {
    return p.capacity != null
      ? { kind: 'capacity', value: p.capacity }
      : { kind: 'hidden' };
  }

  // Containers: cases, secure-containers, storage-containers
  const isCase =
    types.includes('cases') ||
    (item.name != null && /кейс/i.test(item.name));
  const isSecureContainer = types.includes('secure-containers');
  const isStorageContainer = types.includes('storage-containers');

  if (
    CONTAINER_SLUGS.has(slug) ||
    isCase ||
    isSecureContainer ||
    isStorageContainer
  ) {
    const gridCapacity = calculateContainerCapacity(item);
    const fallback = p.capacity ?? null;
    const value = gridCapacity ?? fallback;
    return value != null ? { kind: 'capacity', value } : { kind: 'hidden' };
  }

  // TacticalRig — with plates → durability; without → capacity
  if (RIG_SLUGS.has(slug) || types.includes('rig')) {
    if (p.class && p.class > 0 && p.durability != null) {
      return { kind: 'durability', current: p.durability, max: p.durability };
    }
    return p.capacity != null
      ? { kind: 'capacity', value: p.capacity }
      : { kind: 'hidden' };
  }

  // Armored items → durability
  if (
    ARMORED_SLUGS.has(slug) ||
    types.includes('armor') ||
    types.includes('helmet') ||
    types.includes('glasses') ||
    types.includes('visor') ||
    types.includes('facecover') ||
    types.includes('armorPlate')
  ) {
    return p.durability != null
      ? { kind: 'durability', current: p.durability, max: p.durability }
      : { kind: 'hidden' };
  }

  // Headphones → estimated hearing range
  if (HEADPHONE_SLUGS.has(slug) || types.includes('headphones')) {
    return { kind: 'hearing', value: calculateHearingRange(p) };
  }

  // Melee → weight (no special properties in API)
  if (MELEE_SLUGS.has(slug)) {
    return item.weight != null ? { kind: 'weight', value: item.weight } : { kind: 'hidden' };
  }

  // Guns → ergonomics (most universal build-relevant stat)
  if (GUN_SLUGS.has(slug) || types.includes('gun')) {
    return p.ergonomics != null
      ? { kind: 'custom', label: 'ЭРГ', value: p.ergonomics }
      : { kind: 'hidden' };
  }

  // Weapon mods → best impactful stat
  if (MOD_SLUGS.has(slug) || types.includes('mods')) {
    const stat = getBestModStat(p);
    return stat
      ? { kind: 'custom', label: '', value: stat }
      : { kind: 'hidden' };
  }

  // Meds: ItemPropertiesMedKit → hitpoints; ItemPropertiesMedicalItem → uses
  if (MEDS_SLUGS.has(slug) || types.includes('meds')) {
    if (p.hitpoints && p.hitpoints > 0) {
      return { kind: 'custom', label: '', value: `${p.hitpoints} HP` };
    }
    if (p.uses && p.uses > 0) {
      return { kind: 'custom', label: '', value: `${p.uses} Исп.` };
    }
    return item.weight != null ? { kind: 'weight', value: item.weight } : { kind: 'hidden' };
  }

  // Provisions: tarkov.dev has no ItemPropertiesFood — weight is the only available stat
  if (PROVISIONS_SLUGS.has(slug) || types.includes('provisions')) {
    return item.weight != null ? { kind: 'weight', value: item.weight } : { kind: 'hidden' };
  }

  // Keys / Keycards → uses/maxUses when available (field not in current GQL query), else weight
  if (KEYS_SLUGS.has(slug) || types.includes('keys') || types.includes('keycard')) {
    if (p.uses != null && p.maxUses != null) {
      return { kind: 'custom', label: '', value: `${p.uses}/${p.maxUses}` };
    }
    return item.weight != null ? { kind: 'weight', value: item.weight } : { kind: 'hidden' };
  }

  // Info items (флешки, SSD, разведданные) → weight
  if (INFO_SLUGS.has(slug)) {
    return item.weight != null ? { kind: 'weight', value: item.weight } : { kind: 'hidden' };
  }

  // Barter / Special → weight
  if (BARTER_SLUGS.has(slug) || types.includes('barter')) {
    return item.weight != null ? { kind: 'weight', value: item.weight } : { kind: 'hidden' };
  }

  // Generic fallback
  return item.weight != null ? { kind: 'weight', value: item.weight } : { kind: 'hidden' };
}

// ─── Trader portrait helpers ───────────────────────────────────────────────────

const TRADER_NAME_MAP: Record<string, string> = {
  'прапор': 'prapor',
  'терапевт': 'therapist',
  'скупщик': 'skier',
  'миротворец': 'peacekeeper',
  'механик': 'mechanic',
  'барыга': 'ragman',
  'егерь': 'jaeger',
  'забор': 'fence',
  'маяк': 'lightkeeper',
  'хранитель маяка': 'lightkeeper',
  'ref': 'ref',
  'btr driver': 'btrdriver',
  'prapor': 'prapor',
  'therapist': 'therapist',
  'skier': 'skier',
  'peacekeeper': 'peacekeeper',
  'mechanic': 'mechanic',
  'ragman': 'ragman',
  'jaeger': 'jaeger',
  'fence': 'fence',
  'lightkeeper': 'lightkeeper',
};

export function getTraderPortraitPath(name: string): string | null {
  const normalized = TRADER_NAME_MAP[name.toLowerCase()];
  return normalized ? `/images/traders/eft/${normalized}.webp` : null;
}
