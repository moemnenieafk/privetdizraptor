import { Crosshair, Shield, Hammer, Clock, Target, Bomb, Headphones } from 'lucide-react';
import { SectionPanel, MetricCard, ProgressBar } from '@/components/ui/kit';
import { SectionRule } from '@/components/ui/SectionRule';
import { BarterOfferCard } from './BarterOfferCard';
import { CraftOfferCard } from './CraftOfferCard';
import { Badge as SemanticBadge } from '@/components/features/items/Badge';
import type { ItemEffectsRaw } from '@/data/eft/item-effects';
import { formatCompactNumber } from '@/lib/formatters';

// === ТИПЫ СВОЙСТВ ПРЕДМЕТОВ ===

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
  ergoPenalty: number | null;
  material: { name: string } | null;
}

export interface MedKitProperties {
  hitpoints: number;
  useTime: number;
  maxHealPerUse: number | null;
  cures: string[] | null;
  /** Эффекты из зеркала (SPT-дамп игровой базы) — null у предметов вне снимка. */
  itemEffects: ItemEffectsRaw | null;
}

export interface MedicalItemProperties {
  uses: number | null;
  useTime: number;
  cures: string[] | null;
  itemEffects: ItemEffectsRaw | null;
}

/** Провизия: энергия/гидрация — заголовочные цифры, остальное в itemEffects. */
export interface FoodDrinkProperties {
  energy: number | null;
  hydration: number | null;
  units: number | null;
  itemEffects: ItemEffectsRaw | null;
}

/** Холодное оружие: эффекты в itemEffects вешаются на цель, а не на владельца. */
export interface MeleeProperties {
  slashDamage: number | null;
  stabDamage: number | null;
  hitRadius: number | null;
  itemEffects: ItemEffectsRaw | null;
}

export interface GridAllowedItem {
  id: string;
  name?: string;
  shortName?: string;
}
export interface GridFilters {
  allowedCategories?: { id: string; name: string }[];
  allowedItems?: GridAllowedItem[];
}
export interface GridInfo {
  width: number;
  height: number;
  /** Что вмещает ячейка: допустимые категории/предметы (tarkov.dev grids[].filters). */
  filters?: GridFilters;
}

export interface ContainerProperties {
  grids: GridInfo[];
}

export interface AmmoProperties {
  caliber: string | null;
  damage: number | null;
  penetrationPower: number | null;
  armorDamage: number | null;
  fragmentationChance: number | null;
  initialSpeed: number | null;
}

export interface GrenadeProperties {
  type: string | null;
  fuse: number | null;
  minExplosionDistance: number | null;
  maxExplosionDistance: number | null;
  fragments: number | null;
}

export interface HeadphoneProperties {
  distanceModifier: number | null;
  ambientVolume: number | null;
}

export interface HelmetProperties {
  class: number;
  durability: number;
  deafening: string | null;
  headZones: string[] | null;
  material: { name: string } | null;
  blocksHeadset: boolean | null;
  speedPenalty: number | null;
  turnPenalty: number | null;
  ergoPenalty: number | null;
}

export interface BackpackProperties {
  grids: GridInfo[];
  speedPenalty: number | null;
  turnPenalty: number | null;
  ergoPenalty: number | null;
}

export type ItemProperties =
  | WeaponProperties
  | ArmorProperties
  | MedKitProperties
  | MedicalItemProperties
  | FoodDrinkProperties
  | MeleeProperties
  | ContainerProperties
  | AmmoProperties
  | GrenadeProperties
  | HeadphoneProperties
  | HelmetProperties
  | BackpackProperties
  | null;

// === TYPE GUARDS ===

function isWeaponProps(p: NonNullable<ItemProperties>): p is WeaponProperties {
  return 'recoilVertical' in p;
}

function isArmorProps(p: NonNullable<ItemProperties>): p is ArmorProperties {
  return 'class' in p && !('headZones' in p) && !('grids' in p);
}

export function isMedKitProps(p: NonNullable<ItemProperties>): p is MedKitProperties {
  return 'hitpoints' in p;
}

export function isMedicalItemProps(p: NonNullable<ItemProperties>): p is MedicalItemProperties {
  return 'useTime' in p && !('hitpoints' in p) && !('recoilVertical' in p) && !('penetrationPower' in p);
}

function isAmmoProps(p: NonNullable<ItemProperties>): p is AmmoProperties {
  return 'penetrationPower' in p;
}

function isGrenadeProps(p: NonNullable<ItemProperties>): p is GrenadeProperties {
  return 'fuse' in p;
}

function isHeadphoneProps(p: NonNullable<ItemProperties>): p is HeadphoneProperties {
  return 'distanceModifier' in p;
}

function isHelmetProps(p: NonNullable<ItemProperties>): p is HelmetProperties {
  return 'headZones' in p;
}

// === ТИПЫ ДЛЯ ТОРГОВЛИ ===

export interface VendorOffer {
  price: number;
  priceRUB?: number;
  /** Валюта оффера: RUB | USD | EUR. Нужна для вторичной цены под рублёвой. */
  currency?: string;
  /** Цена в PvE-режиме (появится с PvE-синком; пока undefined → фолбэк на PvP). */
  pricePve?: number;
  priceRUBPve?: number;
  vendor: {
    name: string;
    normalizedName: string;
    minTraderLevel?: number;
  };
}

// === ТИПЫ ДЛЯ БАРТЕРА ===

interface BarterRequiredItem {
  item: {
    id: string;
    name: string;
    shortName: string;
    image512pxLink: string;
    basePrice: number;
    backgroundColor?: string;
    normalizedName?: string; // для кросс-линка на карточку предмета
    /** Рыночная цена барахолки. basePrice — игровая условность, для экономики не годится. */
    marketPrice?: number;
  };
  count: number;
}

// Квест-гейт бартера (разблокировка по заданию) — для бейджа со ссылкой на карту квестов.
export interface BarterTaskUnlock {
  id: string;
  name?: string;
}

export interface BarterOffer {
  id: string;
  trader: {
    name: string;
    normalizedName: string;
  };
  level: number;
  taskUnlock?: BarterTaskUnlock | null;
  requiredItems: BarterRequiredItem[];
  /** Покупок за сброс торговца; null — лимита нет. */
  buyLimit?: number | null;
  /** Что и сколько выдаётся. */
  reward?: { item: BarterRequiredItem['item']; count: number };
}

// === ТИПЫ ДЛЯ КРАФТА ===

interface CraftRequiredItem {
  item: {
    id: string;
    name: string;
    shortName: string;
    image512pxLink: string;
    backgroundColor?: string;
    normalizedName?: string;
    hasBarter?: boolean; // ингредиент доступен по бартеру (сорсинг-подсказка)
    /** Рыночная цена барахолки — для экономики крафта. */
    marketPrice?: number;
    basePrice?: number;
  };
  count: number;
}

export interface CraftRecipe {
  id: string;
  station: {
    name: string;
    normalizedName: string;
  };
  level: number;
  duration: number;
  requiredItems: CraftRequiredItem[];
  /** Что и сколько производится. */
  reward?: { item: CraftRequiredItem['item'] & { basePrice?: number }; count: number };
}

// === МОДУЛЬ ОРУЖИЯ ===

export function WeaponModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isWeaponProps(properties)) return null;

  return (
    <SectionPanel title="Боевые Характеристики" icon={<Crosshair className="w-4 h-4" />} noDivider smallTitle bare>
      <div className="space-y-4">
        <ProgressBar label="Эргономика" value={properties.ergonomics ?? 0} max={100} colorClass="bg-emerald-500" />
        <ProgressBar label="Вертикальная отдача" value={properties.recoilVertical ?? 0} max={300} inverse />
        <ProgressBar label="Горизонтальная отдача" value={properties.recoilHorizontal ?? 0} max={400} inverse />

        <div className="grid grid-cols-2 gap-4 pt-2 mt-4 border-t border-lines-hover">
          <MetricCard label="Скорострельность" value={`${properties.fireRate ?? 0}`} subtext="выстр/мин" />
          <MetricCard label="Калибр" value={properties.caliber?.replace('Caliber', '') ?? 'Н/Д'} accent="primary" />
        </div>
      </div>
    </SectionPanel>
  );
}

// === МОДУЛЬ БРОНИ ===

export function ArmorModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isArmorProps(properties)) return null;

  return (
    <SectionPanel title="Защита и Баллистика" icon={<Shield className="w-4 h-4" />} noDivider smallTitle bare>
      <div className="grid grid-cols-2 gap-4 mb-4 md:grid-cols-3">
        <MetricCard label="Класс брони" value={`Класс ${properties.class}`} accent="primary" />
        <MetricCard label="Прочность" value={`${properties.durability}`} subtext="Максимальная" accent="success" />
        <MetricCard label="Материал" value={properties.material?.name ?? 'Н/Д'} className="col-span-2 md:col-span-1" />
      </div>
      <div className="space-y-4">
        {properties.speedPenalty != null && (
          <ProgressBar label="Штраф к скорости" value={Math.abs(properties.speedPenalty)} max={30} inverse suffix="%" />
        )}
        {properties.turnPenalty != null && (
          <ProgressBar label="Штраф к повороту" value={Math.abs(properties.turnPenalty)} max={30} inverse suffix="%" />
        )}
        {properties.ergoPenalty != null && (
          <ProgressBar label="Штраф к эргономике" value={Math.abs(properties.ergoPenalty)} max={30} inverse suffix="%" />
        )}
      </div>
    </SectionPanel>
  );
}

// Медицина живёт в ItemEffectsModule — блок «Медицинские эффекты» по макету
// MEDICAL_EFFECT: плитки + списки снимаемых/добавляемых эффектов.

// === МОДУЛЬ ПАТРОНОВ ===

export function AmmoModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isAmmoProps(properties)) return null;

  const frag = Number(properties.fragmentationChance ?? 0);
  const pen = Number(properties.penetrationPower ?? 0);
  const isFragBlocked = pen < 20;

  return (
    <SectionPanel title="Баллистика" icon={<Target className="w-4 h-4" />} noDivider smallTitle bare>
      <div className="grid grid-cols-2 gap-4 mb-4 md:grid-cols-4">
        <MetricCard
          label="Калибр"
          value={properties.caliber?.replace('Caliber', '') ?? 'Н/Д'}
          accent="primary"
        />
        <MetricCard
          label="Начальная скорость"
          value={`${properties.initialSpeed ?? 0} м/с`}
        />
        <MetricCard
          label="Урон"
          value={properties.damage ?? 0}
          accent="danger"
        />
        <MetricCard
          label="Пробитие"
          value={properties.penetrationPower ?? 0}
          accent="success"
        />
      </div>

      <div className="space-y-4">
        <ProgressBar
          label="Урон броне"
          value={properties.armorDamage ?? 0}
          max={100}
          suffix="%"
          colorClass="bg-amber-500"
        />
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-lines-hover">
        <span className="text-xs uppercase tracking-wider font-blender-medium text-text-secondary">
          Фрагментация
        </span>
        <SemanticBadge
          color={isFragBlocked ? 'gray' : 'amber'}
          label={isFragBlocked ? 'Блок.' : `${Math.round(frag * 100)}%`}
          isStrike={isFragBlocked}
          title={isFragBlocked ? 'Фрагментация невозможна: пробитие < 20' : 'Шанс фрагментации'}
        />
      </div>
    </SectionPanel>
  );
}

// === МОДУЛЬ ГРАНАТ ===

export function GrenadeModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isGrenadeProps(properties)) return null;

  return (
    <SectionPanel title="Взрывные характеристики" icon={<Bomb className="w-4 h-4" />} noDivider smallTitle bare>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Тип"
          value={properties.type ?? 'Н/Д'}
          accent="primary"
        />
        <MetricCard
          label="Осколки"
          value={properties.fragments ?? 0}
          subtext="осколков"
          accent="danger"
        />
        <MetricCard
          label="Взрыватель"
          value={`${properties.fuse ?? 0} с`}
          accent="warning"
        />
        <MetricCard
          label="Радиус взрыва"
          value={`${properties.minExplosionDistance ?? 0}–${properties.maxExplosionDistance ?? 0} м`}
        />
      </div>
    </SectionPanel>
  );
}

// === МОДУЛЬ НАУШНИКОВ ===

export function HeadsetModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isHeadphoneProps(properties)) return null;

  const distanceBonus = Math.round(((properties.distanceModifier ?? 1) - 1) * 100);
  const ambientVol = Math.abs(properties.ambientVolume ?? 0);

  return (
    <SectionPanel title="Акустические параметры" icon={<Headphones className="w-4 h-4" />} noDivider smallTitle bare>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <MetricCard
          label="Дальность слуха"
          value={`+${distanceBonus}%`}
          accent="success"
        />
        <MetricCard
          label="Окр. шум"
          value={`${properties.ambientVolume ?? 0} дБ`}
        />
      </div>
      <div className="space-y-4">
        <ProgressBar
          label="Усиление дальности"
          value={distanceBonus}
          max={100}
          suffix="%"
          colorClass="bg-emerald-500"
        />
        <ProgressBar
          label="Окружающий шум"
          value={ambientVol}
          max={30}
          inverse
          suffix=" дБ"
        />
      </div>
    </SectionPanel>
  );
}

// === МОДУЛЬ ШЛЕМОВ ===

export function HelmetModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isHelmetProps(properties)) return null;

  return (
    <SectionPanel title="Шлем и Баллистика" icon={<Shield className="w-4 h-4" />} noDivider smallTitle bare>
      <div className="grid grid-cols-2 gap-4 mb-4 md:grid-cols-3">
        <MetricCard label="Класс брони" value={`Класс ${properties.class}`} accent="primary" />
        <MetricCard label="Прочность" value={`${properties.durability}`} subtext="Максимальная" accent="success" />
        <MetricCard label="Материал" value={properties.material?.name ?? 'Н/Д'} className="col-span-2 md:col-span-1" />
      </div>

      <div className="space-y-4">
        {properties.speedPenalty != null && (
          <ProgressBar label="Штраф к скорости" value={Math.abs(properties.speedPenalty)} max={30} inverse suffix="%" />
        )}
        {properties.turnPenalty != null && (
          <ProgressBar label="Штраф к повороту" value={Math.abs(properties.turnPenalty)} max={30} inverse suffix="%" />
        )}
        {properties.ergoPenalty != null && (
          <ProgressBar label="Штраф к эргономике" value={Math.abs(properties.ergoPenalty)} max={30} inverse suffix="%" />
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-lines-hover grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-type-caption uppercase tracking-widest font-blender-medium text-text-muted">Шумоподавление</span>
          <span className="text-sm font-blender-medium text-text-primary uppercase">
            {properties.deafening ?? 'None'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-type-caption uppercase tracking-widest font-blender-medium text-text-muted">Наушники</span>
          {properties.blocksHeadset
            ? <SemanticBadge color="red" label="Блокирует" className="w-fit" />
            : <span className="text-sm font-blender-medium text-nvg-green uppercase">Совместимы</span>
          }
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-type-caption uppercase tracking-widest font-blender-medium text-text-muted">Зоны защиты</span>
          <span className="text-xs font-blender-book text-text-secondary">
            {(properties.headZones ?? []).join(', ') || 'Н/Д'}
          </span>
        </div>
      </div>
    </SectionPanel>
  );
}

// === МОДУЛЬ БАРТЕРА ===

export function BarterModule({ barters }: { barters: BarterOffer[] }) {
  if (barters.length === 0) return null;

  return (
    <section className="flex w-full max-w-[724px] flex-col gap-3.5">
      <SectionRule title="Бартер" icon={<span className="icon-eft-prog-barter h-4 w-4 bg-text-muted mask-contain mask-center mask-no-repeat" />} />
      <div className="flex flex-col gap-3.5">
        {barters.map((offer) => (
          <BarterOfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    </section>
  );
}

// === МОДУЛЬ КРАФТА (УБЕЖИЩЕ) ===

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h > 0 ? `${h}ч ` : ''}${m}м`;
};

// Иконки станций убежища (icons.css: icon-eft-{station}), underscore-нотация
const HIDEOUT_ICONS = new Set([
  'air_filtering_unit', 'bitcoin_farm', 'booze_generator', 'cultist_circle', 'defective_wall',
  'gear_rack', 'generator', 'gym', 'hall_of_fame', 'heating', 'illumitation', 'intelligence_centre',
  'lavatory', 'med_station', 'nutrition_unit', 'rest_space', 'scav_case', 'security',
  'shooting_range', 'solar_power', 'stash', 'water_collector', 'weapon_rack', 'workbench',
]);
const STATION_ICON_OVERRIDE: Record<string, string> = {
  'intelligence-center': 'intelligence_centre',
  'medstation': 'med_station',
  'med-station': 'med_station',
};
export function stationIconClass(normalizedName: string): string {
  const key = STATION_ICON_OVERRIDE[normalizedName] ?? normalizedName.replace(/-/g, '_');
  return HIDEOUT_ICONS.has(key) ? `icon-eft-${key}` : 'icon-eft-prog-hideout';
}

export function CraftModule({ crafts }: { crafts: CraftRecipe[] }) {
  if (crafts.length === 0) return null;

  return (
    <section className="flex w-full max-w-[724px] flex-col gap-3.5">
      <SectionRule title="Производство" icon={<span className="icon-eft-prog-craft h-4 w-4 bg-text-muted mask-contain mask-center mask-no-repeat" />} />
      <div className="flex flex-col gap-3.5">
        {crafts.map((recipe) => (
          <CraftOfferCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </section>
  );
}

// === ОБРАТНОЕ: «Используется в бартере» (предмет — ингредиент) ===

export function UsedInBarterModule({ usedIn, itemId }: { usedIn: BarterOffer[]; itemId?: string }) {
  if (usedIn.length === 0) return null;

  return (
    <section className="flex w-full max-w-[724px] flex-col gap-3.5">
      <SectionRule title="Используется в бартере" icon={<span className="icon-eft-prog-barter h-4 w-4 bg-text-muted mask-contain mask-center mask-no-repeat" />} />
      <div className="flex flex-col gap-3.5">
        {usedIn.map((offer) => (
          <BarterOfferCard key={offer.id} offer={offer} highlightItemId={itemId} />
        ))}
      </div>
    </section>
  );
}

// === ОБРАТНОЕ: «Используется в крафте» (предмет — ингредиент) ===

export function UsedInCraftModule({ usedIn, itemId }: { usedIn: CraftRecipe[]; itemId?: string }) {
  if (usedIn.length === 0) return null;

  return (
    <section className="flex w-full max-w-[724px] flex-col gap-3.5">
      <SectionRule title="Используется в производстве" icon={<span className="icon-eft-prog-craft h-4 w-4 bg-text-muted mask-contain mask-center mask-no-repeat" />} />
      <div className="flex flex-col gap-3.5">
        {usedIn.map((recipe) => (
          <CraftOfferCard key={recipe.id} recipe={recipe} highlightItemId={itemId} />
        ))}
      </div>
    </section>
  );
}
