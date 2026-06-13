import Image from 'next/image';
import { Crosshair, Shield, HeartPulse, Package, ShoppingCart, Coins, ArrowLeftRight, Hammer, Clock } from 'lucide-react';
import { SectionPanel, MetricCard, ProgressBar } from '@/components/ui/kit';
import { formatCompactNumber, getCurrencySymbol } from '@/lib/formatters';

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

// === TYPE GUARDS ===

function isWeaponProps(p: NonNullable<ItemProperties>): p is WeaponProperties {
  return 'recoilVertical' in p;
}

function isArmorProps(p: NonNullable<ItemProperties>): p is ArmorProperties {
  return 'class' in p;
}

function isMedicalProps(p: NonNullable<ItemProperties>): p is MedicalProperties {
  return 'useTime' in p;
}

function isContainerProps(p: NonNullable<ItemProperties>): p is ContainerProperties {
  return 'grids' in p;
}

// === ТИПЫ ДЛЯ ТОРГОВЛИ ===

export interface VendorOffer {
  price: number;
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

// === МОДУЛЬ БРОНИ И ШЛЕМОВ ===

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
      </div>
    </SectionPanel>
  );
}

// === МОДУЛЬ МЕДИЦИНЫ ===

export function MedicalModule({ properties }: { properties: ItemProperties }) {
  if (!properties || !isMedicalProps(properties)) return null;

  return (
    <SectionPanel title="Медицинские данные" icon={<HeartPulse className="w-4 h-4" />}>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Время применения" value={`${properties.useTime} сек.`} accent="warning" />
        <MetricCard label="Ресурс (Использования)" value={properties.uses ?? 1} accent="primary" />
        {properties.hpCost != null && properties.hpCost > 0 && (
          <MetricCard label="Восстановление HP" value={`+${properties.hpCost}`} accent="success" className="col-span-2" />
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

      <div className="pt-4 mt-6 border-t border-lines-hover">
        <h3 className="mb-4 text-xs uppercase tracking-wider font-blender-medium text-text-secondary">
          Внутренняя геометрия (Секции)
        </h3>
        <div className="flex flex-wrap items-start justify-start gap-4">
          {properties.grids.map((grid, index) => {
            const slots = grid.width * grid.height;
            return (
              <div
                key={index}
                className="relative inline-flex flex-col items-center justify-center overflow-hidden min-w-28 min-h-28 p-2 rounded border border-lines-hover bg-card-menu/40 shadow-inner"
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-[1.35px] opacity-40">
                  {Array.from({ length: grid.height }).map((_, rIdx) => (
                    <div key={rIdx} className="flex items-center justify-center gap-[1.35px]">
                      {Array.from({ length: grid.width }).map((_, cIdx) => (
                        <div
                          key={cIdx}
                          className="w-1.5 h-1.5 bg-(--color-base) border border-lines-hover/20"
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none drop-shadow-md">
                  <div className="text-sm leading-4 font-blender-medium text-text-secondary [text-shadow:-1px_1px_0px_rgb(0_0_0/1.00)]">
                    {grid.width}x{grid.height}
                  </div>
                  <div className="mt-1 text-3xl leading-7 font-blender-medium text-text-primary [text-shadow:-1px_1px_0px_rgb(0_0_0/1.00)]">
                    {slots}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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

    const currency = getCurrencySymbol(vendor.name);
    const isFlea = vendor.normalizedName === 'flea-market' || vendor.name === 'Flea Market';
    const priceFmt = formatCompactNumber(offer.price);

    return (
      <div
        key={`${vendor.name}-${index}`}
        className="flex items-center justify-between py-2.5 px-2 rounded-sm border-b border-lines-hover last:border-0 transition-colors group hover:bg-card-menu/50"
      >
        <div className="flex items-center gap-2.5">
          {isFlea ? (
            <div className="flex w-7 h-7 shrink-0 items-center justify-center rounded-xs border border-yellow-500/20 bg-yellow-500/10 text-yellow-500 shadow-inner">
              <Coins className="w-4 h-4" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/images/traders/eft/${vendor.normalizedName}.webp`}
              alt={vendor.name}
              className="w-7 h-7 shrink-0 rounded-xs border border-lines-hover/50 object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="flex flex-col">
            <span className="text-[13px] uppercase leading-none tracking-wider font-blender-medium text-text-primary">
              {vendor.name}
            </span>
            {!isFlea && type === 'buy' && (
              <span className="mt-1 font-mono text-[10px] leading-none text-text-muted">
                УР. ДОСТУПА: 1+
              </span>
            )}
          </div>
        </div>
        <span
          title={`${offer.price.toLocaleString('ru-RU')} ${currency}`}
          className={`cursor-help font-mono text-sm font-bold ${type === 'buy' ? 'text-text-primary' : 'text-nvg-green'}`}
        >
          {priceFmt} {currency}
        </span>
      </div>
    );
  };

  const sortedBuyFor = [...(buyFor ?? [])].sort((a, b) => a.price - b.price);
  const sortedSellFor = [...(sellFor ?? [])].sort((a, b) => b.price - a.price);

  return (
    <SectionPanel title="Торговля и Рынок" icon={<ShoppingCart className="w-4 h-4" />}>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <div className="flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-lines-hover">
            <h4 className="text-xs uppercase tracking-widest font-blender-medium text-text-secondary">Покупка</h4>
            <span className="font-mono text-[10px] text-text-muted">Мин. цена</span>
          </div>
          <div className="flex flex-col">
            {sortedBuyFor.length > 0
              ? sortedBuyFor.map((o, i) => renderOffer(o, 'buy', i))
              : <div className="py-4 text-center border border-dashed border-lines-hover rounded font-mono text-xs text-text-muted opacity-50">Нет предложений</div>
            }
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-lines-hover">
            <h4 className="text-xs uppercase tracking-widest font-blender-medium text-text-secondary">Продажа</h4>
            <span className="font-mono text-[10px] text-text-muted">Макс. выгода</span>
          </div>
          <div className="flex flex-col">
            {sortedSellFor.length > 0
              ? sortedSellFor.map((o, i) => renderOffer(o, 'sell', i))
              : <div className="py-4 text-center border border-dashed border-lines-hover rounded font-mono text-xs text-text-muted opacity-50">Нет предложений</div>
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
                {/* Требуемые предметы */}
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
                        <span className="font-mono text-xs font-bold text-text-secondary">
                          x{req.count}
                        </span>
                      </div>
                      {idx < offer.requiredItems.length - 1 && (
                        <span className="ml-1 text-text-muted">+</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Торговец и итоговая стоимость */}
                <div className="flex items-center gap-4 sm:border-l sm:border-lines-hover sm:pl-4">
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-blender-book text-text-primary">
                      {offer.trader.name} LL{offer.level}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        Сумма:
                      </span>
                      <span className="font-mono text-xs font-bold text-text-primary">
                        {formatCompactNumber(totalCost)} ₽
                      </span>
                    </div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/images/traders/eft/${offer.trader.normalizedName}.webp`}
                    alt={offer.trader.name}
                    className="h-10 w-10 shrink-0 rounded-full border border-lines-hover object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
              {/* Необходимые материалы */}
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
                      <span className="font-mono text-xs font-bold text-text-secondary">
                        x{req.count}
                      </span>
                    </div>
                    {idx < recipe.requiredItems.length - 1 && (
                      <span className="ml-1 text-text-muted">+</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Станция убежища, уровень и время */}
              <div className="flex min-w-35 flex-col items-end gap-1 sm:border-l sm:border-lines-hover sm:pl-4">
                <span className="uppercase tracking-widest font-blender-medium text-text-primary">
                  {recipe.station.name}
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    Уровень:
                  </span>
                  <span className="font-mono text-xs font-bold text-text-primary">
                    {recipe.level}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 rounded px-2 py-1 bg-(--color-base)">
                  <Clock className="h-3 w-3 text-text-secondary" />
                  <span className="font-mono text-xs font-bold text-text-secondary">
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
