// Types for item property modules (tarkov.dev GraphQL schema)

export interface WeaponProperties {
  caliber: string | null;
  fireRate: number | null;
  ergonomics: number | null;
  recoilVertical: number | null;
  recoilHorizontal: number | null;
}

export interface ArmorProperties {
  class: number;
  durability: number;
  speedPenalty: number | null;
  turnPenalty: number | null;
  material: { name: string } | null;
}

export interface MedicalProperties {
  useTime: number;
  uses: number | null;
  hpCost: number | null;
}

export interface GridInfo {
  width: number;
  height: number;
}

export interface ContainerProperties {
  grids: GridInfo[];
}

export type ItemProperties =
  | WeaponProperties
  | ArmorProperties
  | MedicalProperties
  | ContainerProperties
  | null;

// Type guards

export function isWeaponProps(p: NonNullable<ItemProperties>): p is WeaponProperties {
  return 'recoilVertical' in p;
}

export function isArmorProps(p: NonNullable<ItemProperties>): p is ArmorProperties {
  return 'class' in p;
}

export function isMedicalProps(p: NonNullable<ItemProperties>): p is MedicalProperties {
  return 'useTime' in p;
}

export function isContainerProps(p: NonNullable<ItemProperties>): p is ContainerProperties {
  return 'grids' in p;
}

// Trade types

export interface VendorOffer {
  price: number;
  vendor: {
    name: string;
    normalizedName: string;
  };
}

export interface BarterOffer {
  id: string;
  trader: {
    name: string;
    normalizedName: string;
  };
  level: number;
  requiredItems: {
    item: {
      id: string;
      name: string;
      shortName: string;
      iconLink: string;
      basePrice: number;
    };
    count: number;
  }[];
}

export interface CraftRecipe {
  id: string;
  station: {
    name: string;
    normalizedName: string;
  };
  level: number;
  duration: number;
  requiredItems: {
    item: {
      id: string;
      name: string;
      shortName: string;
      iconLink: string;
    };
    count: number;
  }[];
}
