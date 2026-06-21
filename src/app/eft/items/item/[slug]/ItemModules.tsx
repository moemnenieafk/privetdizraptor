import Image from 'next/image';
import { Crosshair, Shield, HeartPulse, Package, ShoppingCart, ArrowLeftRight, Hammer, Clock, Target, Bomb, Headphones } from 'lucide-react';
import { SectionPanel, MetricCard, ProgressBar } from '@/components/ui/kit';
import { Badge as SemanticBadge } from '@/components/features/items/Badge';
import { formatCompactNumber } from '@/lib/formatters';
import { VendorImage } from './ItemImage';

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
}

export interface MedicalItemProperties {
  uses: number | null;
  useTime: number;
  cures: string[] | null;
}

export interface GridInfo {
  width: number;
  height: number;
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

function isMedKitProps(p: NonNullable<ItemProperties>): p is MedKitProperties {
  return 'hitpoints' in p;
}

function isMedicalItemProps(p: NonNullable<ItemProperties>): p is MedicalItemProperties {
  return 'useTime' in p && !('hitpoints' in p) && !('recoilVertical' in p) && !('penetrationPower' in p);
}

function isContainerProps(p: NonNullable<ItemProperties>): p is ContainerProperties {
  return 'grids' in p && !('ergoPenalty' in p);
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

function isBackpackProps(p: NonNullable<ItemProperties>): p is BackpackProperties {
  return 'grids' in p && 'ergoPenalty' in p;
}

// === ТИПЫ ДЛЯ ТОРГОВЛИ ===

export interface VendorOffer {
  price: number;
  priceRUB?: number;
  vendor: {
    name: string;
    normalizedName: string;
  };
}

// === ТИПЫ ДЛЯ БАРТЕРА ===

interface BarterRequiredItem {
  item: {
    id: string;
    name: string;
    shortName: string;
    iconLink: string;
    basePrice: number;
  };
  count: number;
}

export interface BarterOffer {
  id: string;
  trader: {
    name: string;
    normalizedName: string;
  };
  level: number;
  requiredItems: BarterRequiredItem[];
}

// === ТИПЫ ДЛЯ КРАФТА ===

interface CraftRequiredItem {
  item: {
    id: string;
    name: string;
    shortName: string;
    iconLink: string;
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
}

// === МОДУЛЬ ОРУЖИЯ ===

export function WeaponModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isWeaponProps(properties)) return null;

  return (
    <SectionPanel title="Боевые Характеристики" icon={<Crosshair className="w-4 h-4" />}>
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
    <SectionPanel title="Защита и Баллистика" icon={<Shield className="w-4 h-4" />}>
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

// === МОДУЛЬ МЕДКИТОВ ===

export function MedKitModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isMedKitProps(properties)) return null;

  return (
    <SectionPanel title="Медицинские данные" icon={<HeartPulse className="w-4 h-4" />}>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Восстановление HP" value={`+${properties.hitpoints}`} accent="success" />
        <MetricCard label="Время применения" value={`${properties.useTime} сек.`} accent="warning" />
        {properties.maxHealPerUse != null && (
          <MetricCard label="Макс. за применение" value={`+${properties.maxHealPerUse}`} accent="default" />
        )}
        {properties.cures && properties.cures.length > 0 && (
          <MetricCard label="Лечит" value={properties.cures.join(', ')} className="col-span-2" />
        )}
      </div>
    </SectionPanel>
  );
}

// === МОДУЛЬ МЕДПРЕДМЕТОВ ===

export function MedicalItemModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isMedicalItemProps(properties)) return null;

  return (
    <SectionPanel title="Медицинские данные" icon={<HeartPulse className="w-4 h-4" />}>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Время применения" value={`${properties.useTime} сек.`} accent="warning" />
        <MetricCard label="Использований" value={properties.uses ?? 1} accent="primary" />
        {properties.cures && properties.cures.length > 0 && (
          <MetricCard label="Лечит" value={properties.cures.join(', ')} className="col-span-2" />
        )}
      </div>
    </SectionPanel>
  );
}

// === МОДУЛЬ КОНТЕЙНЕРОВ ===

interface ContainerModuleProps {
  properties: ItemProperties;
  itemWidth: number;
  itemHeight: number;
}

export function ContainerModule({ properties, itemWidth, itemHeight }: ContainerModuleProps) {
  if (!properties || !isContainerProps(properties) || properties.grids.length === 0) return null;

  const totalCapacity = properties.grids.reduce((acc, grid) => acc + grid.width * grid.height, 0);
  const itemSize = itemWidth * itemHeight;
  const efficiency = itemSize > 0 ? (totalCapacity / itemSize).toFixed(1) : '0';

  return (
    <SectionPanel title="Вместимость" icon={<Package className="w-4 h-4" />}>
      <div className="grid grid-cols-2 gap-4 mb-4 md:grid-cols-3">
        <MetricCard label="Слотов внутри" value={totalCapacity} accent="primary" />
        <MetricCard label="Занимает места" value={itemSize} accent="warning" />
        <MetricCard
          label="Эффективность"
          value={`x${efficiency}`}
          subtext="Отношение размера к вместимости"
          accent={Number(efficiency) > 2 ? 'success' : 'default'}
          className="col-span-2 md:col-span-1"
        />
      </div>
    </SectionPanel>
  );
}

// === МОДУЛЬ ПАТРОНОВ ===

export function AmmoModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isAmmoProps(properties)) return null;

  const frag = Number(properties.fragmentationChance ?? 0);
  const pen = Number(properties.penetrationPower ?? 0);
  const isFragBlocked = pen < 20;

  return (
    <SectionPanel title="Баллистика" icon={<Target className="w-4 h-4" />}>
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
    <SectionPanel title="Взрывные характеристики" icon={<Bomb className="w-4 h-4" />}>
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
    <SectionPanel title="Акустические параметры" icon={<Headphones className="w-4 h-4" />}>
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
    <SectionPanel title="Шлем и Баллистика" icon={<Shield className="w-4 h-4" />}>
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

// === МОДУЛЬ РЮКЗАКОВ ===

interface BackpackModuleProps {
  properties: ItemProperties;
  itemWidth: number;
  itemHeight: number;
}

export function BackpackModule({ properties, itemWidth, itemHeight }: BackpackModuleProps) {
  if (!properties || !isBackpackProps(properties) || properties.grids.length === 0) return null;

  const totalCapacity = properties.grids.reduce((acc, grid) => acc + grid.width * grid.height, 0);
  const itemSize = itemWidth * itemHeight;
  const efficiency = itemSize > 0 ? (totalCapacity / itemSize).toFixed(1) : '0';

  return (
    <SectionPanel title="Вместимость" icon={<Package className="w-4 h-4" />}>
      <div className="grid grid-cols-2 gap-4 mb-4 md:grid-cols-3">
        <MetricCard label="Слотов внутри" value={totalCapacity} accent="primary" />
        <MetricCard label="Занимает места" value={itemSize} accent="warning" />
        <MetricCard
          label="Эффективность"
          value={`x${efficiency}`}
          subtext="Отношение размера к вместимости"
          accent={Number(efficiency) > 2 ? 'success' : 'default'}
          className="col-span-2 md:col-span-1"
        />
      </div>

      <div className="space-y-4 mb-4">
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

// === МОДУЛЬ ТОРГОВЛИ ===

export function TraderModule({ buyFor, sellFor }: { buyFor?: VendorOffer[]; sellFor?: VendorOffer[] }) {
  if (!buyFor?.length && !sellFor?.length) return null;

  const renderOffer = (offer: VendorOffer, type: 'buy' | 'sell', index: number) => {
    const { vendor } = offer;
    if (!vendor || vendor.name === '-') return null;

    const currency = vendor.normalizedName === 'peacekeeper' ? '$' : '₽';
    const isFlea = vendor.normalizedName === 'flea-market' || vendor.name === 'Flea Market';
    const priceFmt = formatCompactNumber(offer.price);

    return (
      <div
        key={`${vendor.name}-${index}`}
        className="flex items-center justify-between py-2.5 px-2 rounded-sm border-b border-lines-hover last:border-0 transition-colors group hover:bg-card-menu/50"
      >
        <div className="flex items-center gap-2.5">
          {isFlea ? (
            <div className="flex w-7 h-7 shrink-0 items-center justify-center rounded-xs border border-yellow-500/20 bg-yellow-500/10 shadow-inner">
              <span className="icon-eft-currency-ruble w-4 h-4 bg-yellow-500/70 mask-contain mask-center mask-no-repeat" />
            </div>
          ) : (
            <VendorImage
              normalizedName={vendor.normalizedName}
              name={vendor.name}
              className="w-7 h-7 shrink-0 rounded-xs border border-lines-hover/50 object-cover"
            />
          )}
          <div className="flex flex-col">
            <span className="text-type-label uppercase leading-none tracking-wider font-blender-medium text-text-primary">
              {vendor.name}
            </span>
            {!isFlea && type === 'buy' && (
              <span className="mt-1 font-blender-medium text-type-caption leading-none text-text-muted">
                УР. ДОСТУПА: 1+
              </span>
            )}
          </div>
        </div>
        <span
          title={`${offer.price.toLocaleString('ru-RU')} ${currency}`}
          className={`cursor-help font-blender-medium text-sm ${type === 'buy' ? 'text-text-primary' : 'text-nvg-green'}`}
        >
          {priceFmt} {currency}
        </span>
      </div>
    );
  };

  const rubVal = (o: VendorOffer) => o.priceRUB ?? o.price;
  const sortedBuyFor = [...(buyFor ?? [])].sort((a, b) => rubVal(a) - rubVal(b));
  const sortedSellFor = [...(sellFor ?? [])].sort((a, b) => rubVal(b) - rubVal(a));

  return (
    <SectionPanel title="Торговля и Рынок" icon={<ShoppingCart className="w-4 h-4" />}>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <div className="flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-lines-hover">
            <h4 className="text-xs uppercase tracking-widest font-blender-medium text-text-secondary">Покупка</h4>
            <span className="font-blender-medium text-type-caption text-text-muted">Мин. цена</span>
          </div>
          <div className="flex flex-col">
            {sortedBuyFor.length > 0
              ? sortedBuyFor.map((o, i) => renderOffer(o, 'buy', i))
              : <div className="py-4 text-center border border-dashed border-lines-hover rounded font-blender-medium text-xs text-text-muted opacity-50">Нет предложений</div>
            }
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-lines-hover">
            <h4 className="text-xs uppercase tracking-widest font-blender-medium text-text-secondary">Продажа</h4>
            <span className="font-blender-medium text-type-caption text-text-muted">Макс. выгода</span>
          </div>
          <div className="flex flex-col">
            {sortedSellFor.length > 0
              ? sortedSellFor.map((o, i) => renderOffer(o, 'sell', i))
              : <div className="py-4 text-center border border-dashed border-lines-hover rounded font-blender-medium text-xs text-text-muted opacity-50">Нет предложений</div>
            }
          </div>
        </div>
      </div>
    </SectionPanel>
  );
}

// === МОДУЛЬ БАРТЕРА ===

export function BarterModule({ barters }: { barters: BarterOffer[] }) {
  return (
    <SectionPanel title="Доступный бартер" icon={<ArrowLeftRight className="w-4 h-4" />}>
      {barters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-text-muted">
          <ArrowLeftRight className="mb-2 h-6 w-6 opacity-40" />
          <p className="text-xs uppercase tracking-widest font-blender-book">Бартер недоступен</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {barters.map((offer) => {
            const totalCost = offer.requiredItems.reduce(
              (sum, req) => sum + req.item.basePrice * req.count,
              0
            );
            return (
              <div
                key={offer.id}
                className="group flex flex-col justify-between gap-4 rounded border border-lines-hover bg-card-menu p-4 transition-colors hover:border-(--primary) sm:flex-row sm:items-center"
              >
                <div className="flex flex-wrap items-center gap-3">
                  {offer.requiredItems.map((req, idx) => (
                    <div key={req.item.id} className="flex items-center gap-2">
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-lines-hover bg-linear-to-b from-lines-hover to-(--color-base) shadow-inner">
                        <Image
                          src={req.item.iconLink}
                          alt={req.item.shortName}
                          fill
                          sizes="48px"
                          className="object-contain p-1"
                          unoptimized
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-blender-book text-text-primary" title={req.item.name}>
                          {req.item.shortName}
                        </span>
                        <span className="font-blender-medium text-xs text-text-secondary">
                          x{req.count}
                        </span>
                      </div>
                      {idx < offer.requiredItems.length - 1 && (
                        <span className="ml-1 text-text-muted">+</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 sm:border-l sm:border-lines-hover sm:pl-4">
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-blender-book text-text-primary">
                      {offer.trader.name} LL{offer.level}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-blender-medium text-type-caption uppercase tracking-wider text-text-muted">
                        Сумма:
                      </span>
                      <span className="font-blender-medium text-xs text-text-primary">
                        {formatCompactNumber(totalCost)} ₽
                      </span>
                    </div>
                  </div>
                  <VendorImage
                    normalizedName={offer.trader.normalizedName}
                    name={offer.trader.name}
                    className="h-10 w-10 shrink-0 rounded-full border border-lines-hover object-cover"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionPanel>
  );
}

// === МОДУЛЬ КРАФТА (УБЕЖИЩЕ) ===

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h > 0 ? `${h}ч ` : ''}${m}м`;
};

export function CraftModule({ crafts }: { crafts: CraftRecipe[] }) {
  return (
    <SectionPanel title="Производство (Убежище)" icon={<Hammer className="w-4 h-4" />}>
      {crafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-text-muted">
          <Hammer className="mb-2 h-6 w-6 opacity-40" />
          <p className="text-xs uppercase tracking-widest font-blender-book">Не производится в Убежище</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {crafts.map((recipe) => (
            <div
              key={recipe.id}
              className="group relative flex flex-col justify-between gap-4 rounded border border-lines-hover bg-card-menu p-4 transition-colors hover:border-(--primary) sm:flex-row sm:items-center"
            >
              <div className="flex flex-wrap items-center gap-3">
                {recipe.requiredItems.map((req, idx) => (
                  <div key={req.item.id} className="flex items-center gap-2">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-lines-hover bg-linear-to-b from-lines-hover to-(--color-base) shadow-inner">
                      <Image
                        src={req.item.iconLink}
                        alt={req.item.shortName}
                        fill
                        sizes="48px"
                        className="object-contain p-1"
                        unoptimized
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-blender-book text-text-primary" title={req.item.name}>
                        {req.item.shortName}
                      </span>
                      <span className="font-blender-medium text-xs text-text-secondary">
                        x{req.count}
                      </span>
                    </div>
                    {idx < recipe.requiredItems.length - 1 && (
                      <span className="ml-1 text-text-muted">+</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex min-w-35 flex-col items-end gap-1 sm:border-l sm:border-lines-hover sm:pl-4">
                <span className="uppercase tracking-widest font-blender-medium text-text-primary">
                  {recipe.station.name}
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-blender-medium text-type-caption uppercase tracking-wider text-text-muted">
                    Уровень:
                  </span>
                  <span className="font-blender-medium text-xs text-text-primary">
                    {recipe.level}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 rounded px-2 py-1 bg-(--color-base)">
                  <Clock className="h-3 w-3 text-text-secondary" />
                  <span className="font-blender-medium text-xs text-text-secondary">
                    {formatDuration(recipe.duration)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}
