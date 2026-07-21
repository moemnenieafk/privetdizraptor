import Link from 'next/link';
import { Crosshair, Shield, HeartPulse, ArrowLeftRight, Hammer, Clock, Target, Bomb, Headphones, Lock, ChevronRight } from 'lucide-react';
import { SectionPanel, MetricCard, ProgressBar } from '@/components/ui/kit';
import { SectionRule } from '@/components/ui/SectionRule';
import { BarterOfferCard } from './BarterOfferCard';
import { CraftOfferCard } from './CraftOfferCard';
import { Badge as SemanticBadge } from '@/components/features/items/Badge';
import { formatCompactNumber } from '@/lib/formatters';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { traderImg } from '@/lib/trader-utils';

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

// === ОБРАТНОЕ НАПРАВЛЕНИЕ: где предмет используется как ингредиент ===
// Слот результата (что производит бартер/крафт, потребляя текущий предмет).
interface ProducedItem {
  item: {
    id: string;
    name: string;
    shortName: string;
    image512pxLink: string;
    backgroundColor?: string;
    normalizedName?: string;
  };
  count: number;
}

export interface UsedInBarter {
  id: string;
  trader: { name: string; normalizedName: string };
  level: number;
  taskUnlock?: BarterTaskUnlock | null;
  usedCount: number; // сколько единиц текущего предмета нужно
  rewardItems: ProducedItem[];
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

// === МОДУЛЬ МЕДКИТОВ ===

export function MedKitModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isMedKitProps(properties)) return null;

  return (
    <SectionPanel title="Медицинские данные" icon={<HeartPulse className="w-4 h-4" />} noDivider smallTitle bare>
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
    <SectionPanel title="Медицинские данные" icon={<HeartPulse className="w-4 h-4" />} noDivider smallTitle bare>
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

// === ОБЩИЕ ХЕЛПЕРЫ КАРТОЧЕК (бартер/крафт) ===

// Градиент-карточка по accent-цвету (как QuestNode)
function accentCardStyle(accent: string): React.CSSProperties {
  return {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: accent,
    boxShadow: `0 0 12px color-mix(in srgb, ${accent} 22%, transparent)`,
    background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${accent} 12%, transparent), #000000)`,
  };
}

// Предмет-ингредиент: чистый image512 в единой рамке 53×53 (стиль QuestNode), тинт по рарности
function ReqItem({
  item,
  count,
}: {
  item: { id: string; name: string; shortName: string; image512pxLink: string; backgroundColor?: string; normalizedName?: string; hasBarter?: boolean };
  count: number;
}) {
  const body = (
    <>
      <div
        className="relative h-13.25 w-13.25 shrink-0 overflow-hidden rounded-xs border border-lines-hover transition-colors group-hover:border-(--primary)"
        style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
      >
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />
        <img
          src={item.image512pxLink}
          alt={item.shortName}
          className="absolute inset-0 z-10 h-full w-full object-contain p-1"
        />
        {item.hasBarter && (
          <span
            title="Доступен по бартеру"
            className="absolute top-0 left-0 z-20 flex h-4 w-4 items-center justify-center rounded-br-xs bg-(--primary)"
          >
            <ArrowLeftRight className="h-2.5 w-2.5 text-(--color-base)" />
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-blender-book text-text-primary transition-colors group-hover:text-(--primary)" title={item.name}>
          {item.shortName}
        </span>
        <span className="font-blender-medium text-xs text-text-secondary">x{count}</span>
      </div>
    </>
  );
  // Кликабельно, только если знаем slug предмета (normalizedName из prices).
  return item.normalizedName ? (
    <Link href={`/eft/items/item/${item.normalizedName}`} className="group flex items-center gap-2">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-2">{body}</div>
  );
}

// === МОДУЛЬ БАРТЕРА ===

export function BarterModule({ barters }: { barters: BarterOffer[] }) {
  if (barters.length === 0) return null;

  return (
    <section className="flex flex-col gap-3.5">
      <SectionRule title="Бартер" icon={<ArrowLeftRight className="h-4 w-4" />} />
      <div className="flex flex-col gap-3.5">
        {barters.map((offer) => (
          <BarterOfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    </section>
  );
}

// Бейдж «открывается квестом» → клик ведёт на карту квестов с фокусом на задание.
function QuestGateBadge({ taskUnlock }: { taskUnlock: BarterTaskUnlock }) {
  return (
    <Link
      href={`/eft/questmap?quest=${taskUnlock.id}`}
      className="group inline-flex w-fit items-center gap-1.5 rounded-xs border border-lines-hover bg-(--color-base) px-2 py-1 font-blender-medium text-xs uppercase tracking-wider text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
    >
      <Lock className="h-3 w-3" />
      <span className="truncate">{taskUnlock.name ? `Квест: ${taskUnlock.name}` : 'Открывается квестом'}</span>
      <ChevronRight className="h-3 w-3 opacity-60 transition-transform group-hover:translate-x-0.5" />
    </Link>
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
    <section className="flex flex-col gap-3.5">
      <SectionRule title="Производство" icon={<Hammer className="h-4 w-4" />} />
      <div className="flex flex-col gap-3.5">
        {crafts.map((recipe) => (
          <CraftOfferCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </section>
  );
}

// === ОБРАТНОЕ: «Используется в бартере» (предмет — ингредиент) ===

export function UsedInBarterModule({ usedIn }: { usedIn: UsedInBarter[] }) {
  if (usedIn.length === 0) return null;
  return (
    <SectionPanel title="Используется в бартере" icon={<ArrowLeftRight className="w-4 h-4" />} noDivider smallTitle bare>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {usedIn.map((offer) => {
          const accent = `var(--trader-${offer.trader.normalizedName})`;
          return (
            <div key={offer.id} className="relative overflow-hidden rounded-lg p-4" style={accentCardStyle(accent)}>
              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <img src={traderImg(offer.trader.normalizedName)} alt={offer.trader.name} width={20} height={20} className="shrink-0 rounded-xs" />
                  <span className="truncate font-blender-medium text-xs uppercase tracking-widest text-text-secondary">{offer.trader.name}</span>
                  <span className="shrink-0 font-blender-medium text-xs text-text-secondary">LL{offer.level}</span>
                  <span className="ml-auto shrink-0 font-blender-medium text-xs text-text-primary">нужно ×{offer.usedCount}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-blender-medium text-xs uppercase tracking-widest text-text-muted">Даёт</span>
                  <ChevronRight className="h-4 w-4 text-text-muted" />
                  {offer.rewardItems.map((rw, idx) => (
                    <div key={rw.item.id} className="flex items-center gap-3">
                      <ReqItem item={rw.item} count={rw.count} />
                      {idx < offer.rewardItems.length - 1 && <span className="text-text-muted">+</span>}
                    </div>
                  ))}
                </div>
                {offer.taskUnlock && <QuestGateBadge taskUnlock={offer.taskUnlock} />}
              </div>
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}

// === ОБРАТНОЕ: «Используется в крафте» (предмет — ингредиент) ===

export function UsedInCraftModule({ usedIn }: { usedIn: CraftRecipe[] }) {
  if (usedIn.length === 0) return null;

  return (
    <section className="flex flex-col gap-3.5">
      <SectionRule title="Используется в производстве" icon={<Hammer className="h-4 w-4" />} />
      <div className="flex flex-col gap-3.5">
        {usedIn.map((recipe) => (
          <CraftOfferCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </section>
  );
}
