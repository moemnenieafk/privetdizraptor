export type ItemCategoryType = 'armor' | 'weapon' | 'ammo' | 'meds' | 'container' | 'headset' | 'common';

export interface BaseItemMetadata {
  id: string;
  name: string;
  shortName: string;
  iconLink: string;
  backgroundColor: string;
  fleaPrice: number | null;
  gridWidth: number;
  gridHeight: number;
}

export interface ArmorMetrics extends BaseItemMetadata {
  category: 'armor';
  armorClass: number;
  durability: number;
  maxDurability: number;
  material: string;
  speedPenalty: number;
  ergoPenalty: number;
  effectiveDurability?: number;
  repairability?: string;
  weight?: number;
  turnPenalty?: number;
  softArmorClass?: number;
  plateArmorClass?: number;
}

export interface WeaponMetrics extends BaseItemMetadata {
  category: 'weapon';
  caliber: string;
  ergonomics: number;
  verticalRecoil: number;
  horizontalRecoil: number;
  recoilDispersion: number;
  convergence: number;
  cameraRecoil: number;
}

export interface AmmoMetrics extends BaseItemMetadata {
  category: 'ammo';
  penetrationPower: number;
  damage: number;
  armorDamage: number;
  fragmentationChance: number;
}

export interface HeadsetMetrics extends BaseItemMetadata {
  category: 'headset';
  distanceModifier: number;
  ambientVolume: number;
}

export interface CommonItemMetrics extends BaseItemMetadata {
  category: 'meds' | 'container' | 'common';
}

export type TarkovItem = ArmorMetrics | WeaponMetrics | AmmoMetrics | HeadsetMetrics | CommonItemMetrics;