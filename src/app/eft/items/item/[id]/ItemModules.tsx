import React from 'react';
import { Crosshair, Shield, HeartPulse, Package, ShoppingCart, Coins } from 'lucide-react';
import { SectionPanel, MetricCard, ProgressBar } from '@/components/ui/kit';
import { formatCompactNumber, getCurrencySymbol } from '@/lib/formatters';

// --- МОДУЛЬ ОРУЖИЯ ---
export function WeaponModule({ properties }: { properties: any }) {
  if (!properties || !properties.recoilVertical) return null;
  
  return (
    <SectionPanel title="Боевые Характеристики" icon={<Crosshair className="w-4 h-4" />}>
      <div className="space-y-4">
        <ProgressBar label="Эргономика" value={properties.ergonomics || 0} max={100} colorClass="bg-emerald-500" />
        <ProgressBar label="Вертикальная отдача" value={properties.recoilVertical} max={300} inverse />
        <ProgressBar label="Горизонтальная отдача" value={properties.recoilHorizontal || 0} max={400} inverse />
        
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-lines-hover mt-4">
          <MetricCard label="Скорострельность" value={`${properties.fireRate || 0}`} subtext="выстр/мин" />
          <MetricCard label="Калибр" value={properties.caliber?.replace('Caliber', '') || 'Н/Д'} accent="primary" />
        </div>
      </div>
    </SectionPanel>
  );
}

// --- МОДУЛЬ ЭКОНОМИКИ И ТОРГОВЦЕВ ---
export function TraderModule({ buyFor, sellFor }: { buyFor?: any[], sellFor?: any[] }) {
  if (!buyFor?.length && !sellFor?.length) return null;

  const renderOffer = (offer: any, type: 'buy' | 'sell', index: number) => {
    const vendor = offer.vendor;
    if (!vendor || vendor.name === '-') return null;

    const currency = getCurrencySymbol(vendor.name);
    const isFlea = vendor.normalizedName === 'flea-market' || vendor.name === 'Flea Market';
    const priceFmt = formatCompactNumber(offer.price);

    return (
      <div key={`${vendor.name}-${index}`} className="flex items-center justify-between py-2.5 border-b border-[var(--color-lines-hover)] last:border-0 group hover:bg-[var(--color-card-menu)]/50 px-2 rounded-sm transition-colors">
        <div className="flex items-center gap-2.5">
          {isFlea ? (
            <div className="w-7 h-7 flex items-center justify-center bg-yellow-500/10 text-yellow-500 rounded-[2px] border border-yellow-500/20 shadow-inner shrink-0">
              <Coins className="w-4 h-4" />
            </div>
          ) : (
            <img
              src={`/images/traders/eft/${vendor.normalizedName || vendor.name.toLowerCase()}.webp`}
              alt={vendor.name}
              className="w-7 h-7 object-cover rounded-[2px] border border-[var(--color-lines-hover)]/50 shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="flex flex-col">
            <span className="font-blender-medium text-[13px] text-[var(--color-text-primary)] uppercase tracking-wider leading-none">
              {vendor.name}
            </span>
            {/* Имитация вывода уровня лояльности, так как в GraphQL buyFor пока не отдает этот ключ явно */}
            {!isFlea && type === 'buy' && (
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono leading-none mt-1">УР. ДОСТУПА: 1+</span>
            )}
          </div>
        </div>
        <span title={`${offer.price.toLocaleString('ru-RU')} ${currency}`} className={`cursor-help font-mono text-sm font-bold ${type === 'buy' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-nvg-green)]'}`}>
          {priceFmt} {currency}
        </span>
      </div>
    );
  };

  // Сортируем: для покупки показываем самые выгодные (дешевые), для продажи - самые дорогие
  const sortedBuyFor = [...(buyFor || [])].sort((a, b) => a.price - b.price);
  const sortedSellFor = [...(sellFor || [])].sort((a, b) => b.price - a.price);

  return (
    <SectionPanel title="Торговля и Рынок" icon={<ShoppingCart className="w-4 h-4" />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Колонка "Где купить" */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3 border-b border-[var(--color-lines-hover)] pb-2">
            <h4 className="text-xs font-blender-medium uppercase tracking-widest text-[var(--color-text-secondary)]">Покупка</h4>
            <span className="text-[10px] font-mono text-[var(--color-text-muted)]">Мин. цена</span>
          </div>
          <div className="flex flex-col">
            {sortedBuyFor.length > 0 ? sortedBuyFor.map((o, i) => renderOffer(o, 'buy', i)) : (
              <div className="py-4 text-center text-[var(--color-text-muted)] font-mono text-xs opacity-50 border border-dashed border-[var(--color-lines-hover)] rounded">Нет предложений</div>
            )}
          </div>
        </div>

        {/* Колонка "Кому сдать" */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3 border-b border-[var(--color-lines-hover)] pb-2">
            <h4 className="text-xs font-blender-medium uppercase tracking-widest text-[var(--color-text-secondary)]">Продажа</h4>
            <span className="text-[10px] font-mono text-[var(--color-text-muted)]">Макс. выгода</span>
          </div>
          <div className="flex flex-col">
            {sortedSellFor.length > 0 ? sortedSellFor.map((o, i) => renderOffer(o, 'sell', i)) : (
              <div className="py-4 text-center text-[var(--color-text-muted)] font-mono text-xs opacity-50 border border-dashed border-[var(--color-lines-hover)] rounded">Нет предложений</div>
            )}
          </div>
        </div>
      </div>
    </SectionPanel>
  );
}

// --- МОДУЛЬ БРОНИ И ШЛЕМОВ ---
export function ArmorModule({ properties }: { properties: any }) {
  if (!properties || !properties.class) return null;

  return (
    <SectionPanel title="Защита и Баллистика" icon={<Shield className="w-4 h-4" />}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <MetricCard label="Класс брони" value={`Класс ${properties.class}`} accent="primary" />
        <MetricCard label="Прочность" value={`${properties.durability}`} subtext="Максимальная" accent="success" />
        <MetricCard label="Материал" value={properties.material?.name || 'Н/Д'} className="col-span-2 md:col-span-1" />
      </div>
      <div className="space-y-4">
        {properties.speedPenalty && (
          <ProgressBar label="Штраф к скорости" value={Math.abs(properties.speedPenalty)} max={30} inverse suffix="%" />
        )}
        {properties.turnPenalty && (
          <ProgressBar label="Штраф к повороту" value={Math.abs(properties.turnPenalty)} max={30} inverse suffix="%" />
        )}
      </div>
    </SectionPanel>
  );
}

// --- МОДУЛЬ МЕДИЦИНЫ ---
export function MedicalModule({ properties }: { properties: any }) {
  if (!properties || !properties.useTime) return null;

  return (
    <SectionPanel title="Медицинские данные" icon={<HeartPulse className="w-4 h-4" />}>
      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Время применения" value={`${properties.useTime} сек.`} accent="warning" />
        <MetricCard label="Ресурс (Использования)" value={properties.uses || 1} accent="primary" />
        
        {properties.hpCost > 0 && (
          <MetricCard label="Восстановление HP" value={`+${properties.hpCost}`} accent="success" className="col-span-2" />
        )}
      </div>
      {/* Здесь можно добавить список снимаемых негативных эффектов (кровотечения, боль) */}
    </SectionPanel>
  );
}

export interface GridInfo {
  width: number;
  height: number;
}

export interface ContainerProperties {
  grids?: GridInfo[];
}

interface ContainerModuleProps {
  properties?: ContainerProperties | null;
  itemWidth: number;
  itemHeight: number;
}

// --- МОДУЛЬ КОНТЕЙНЕРОВ (Кейсы, Рюкзаки, Разгрузки) ---
export function ContainerModule({ properties, itemWidth, itemHeight }: ContainerModuleProps) {
  if (!properties || !properties.grids || properties.grids.length === 0) return null;

  const totalCapacity = properties.grids.reduce((acc, grid) => acc + (grid.width * grid.height), 0);
  const itemSize = itemWidth * itemHeight;
  const efficiency = itemSize > 0 ? (totalCapacity / itemSize).toFixed(1) : '0';

  return (
    <SectionPanel title="Вместимость" icon={<Package className="w-4 h-4" />}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
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
      
      {/* Отрисовка визуальной сетки инвентаря */}
      <div className="mt-6 pt-4 border-t border-lines-hover">
        <h3 className="mb-4 text-xs font-blender-medium text-text-secondary tracking-wider uppercase">Внутренняя геометрия (Секции)</h3>
        <div className="flex flex-wrap items-start justify-start gap-4">
          {properties.grids.map((grid, index) => {
            const slots = grid.width * grid.height;
            return (
              <div key={index} className="relative inline-flex flex-col items-center justify-center overflow-hidden min-w-[112px] min-h-[112px] p-2 bg-card-menu/40 border border-lines-hover rounded shadow-inner">
                
                {/* Ячейки сетки на фоне */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-[1.35px] opacity-40">
                  {Array.from({ length: grid.height }).map((_, rIdx) => (
                    <div key={rIdx} className="flex items-center justify-center gap-[1.35px]">
                      {Array.from({ length: grid.width }).map((_, cIdx) => (
                        <div key={cIdx} className="w-1.5 h-1.5 bg-[#0D0D0F] border border-black/20" />
                      ))}
                    </div>
                  ))}
                </div>

                {/* Текстовые данные поверх сетки */}
                <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none drop-shadow-md">
                  <div className="text-sm font-blender-medium text-text-secondary leading-4 [text-shadow:_-1px_1px_0px_rgb(0_0_0_/_1.00)]">
                    {grid.width}x{grid.height}
                  </div>
                  <div className="mt-1 text-3xl font-blender-medium text-text-primary leading-7 [text-shadow:_-1px_1px_0px_rgb(0_0_0_/_1.00)]">
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