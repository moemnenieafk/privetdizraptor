"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Search, X, LayoutGrid, List, ArrowDownUp, PackageX, Coins, ChevronUp, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/kit';
import { Badge as SemanticBadge, getArmorClassColor } from '@/components/features/items/Badge';
import { ItemTile } from '@/components/features/items/ItemTile';

// 1. Типизация, основанная на GraphQL tarkov.dev
export interface CategoryItem {
  id: string;
  name: string;
  shortName: string;
  width: number;
  height: number;
  backgroundColor?: string;
  basePrice: number;
  image512pxLink: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: any;
  sellFor: { price: number; vendor: { name: string; normalizedName?: string } }[];
  buyFor: { price: number; vendor: { name: string; normalizedName?: string } }[];
}

interface ItemsCategoryClientProps {
  initialData: CategoryItem[];
  categorySlug?: string;
}

// 2. Хелпер для вычисления экономики предмета
function getEconomics(item: CategoryItem) {
  const slots = item.width * item.height || 1;
  
  const fleaBuy = item.buyFor?.find(b => b.vendor.name === 'Flea Market' || b.vendor.normalizedName === 'flea-market');
  const fleaSell = item.sellFor?.find(s => s.vendor.name === 'Flea Market' || s.vendor.normalizedName === 'flea-market');
  
  const traderSells = item.sellFor?.filter(s => s.vendor.name !== 'Flea Market' && s.vendor.normalizedName !== 'flea-market') || [];
  const bestTraderSell = traderSells.length 
    ? traderSells.reduce((max, curr) => (curr.price > max.price ? curr : max), traderSells[0]) 
    : { price: 0, vendor: { name: '-' } };

  // Ищем самую выгодную цену продажи в целом
  const bestSell = item.sellFor?.length 
    ? item.sellFor.reduce((max, curr) => (curr.price > max.price ? curr : max), item.sellFor[0]) 
    : { price: 0, vendor: { name: '-' } };
  
  // Ищем самую дешевую цену покупки
  const bestBuy = item.buyFor?.length 
    ? item.buyFor.reduce((min, curr) => (curr.price < min.price ? curr : min), item.buyFor[0]) 
    : { price: 0, vendor: { name: '-' } };

  const minPrice = bestBuy.price || 0;
  const vps = slots > 0 ? Math.floor(bestSell.price / slots) : 0;
  
  return { slots, bestSell, bestBuy, vps, fleaBuy, fleaSell, bestTraderSell, minPrice };
}

// Компонент для отображения иконки торговца или барахолки
function VendorIcon({ vendor }: { vendor: { name: string; normalizedName?: string } }) {
  if (!vendor || vendor.name === '-') return null;
  
  if (vendor.name === 'Flea Market' || vendor.normalizedName === 'flea-market') {
    return <Coins className="w-4 h-4 text-yellow-500 shrink-0" />;
  }
  
  if (!vendor.normalizedName) return <span className="w-4 h-4 shrink-0" />;
  
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/images/traders/eft/${vendor.normalizedName}.webp`} alt={vendor.name} className="w-4 h-4 object-cover rounded-sm shrink-0" title={vendor.name} />;
}

export function ItemsCategoryClient({ initialData, categorySlug }: ItemsCategoryClientProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'vps', direction: 'desc' });
  const [activeArmorClasses, setActiveArmorClasses] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // 3. Вычисление, фильтрация и сортировка данных (Мемоизировано для производительности)
  const processedItems = useMemo(() => {
    let data = initialData.map(item => ({
      ...item,
      eco: getEconomics(item)
    }));

    data = data.filter(item => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = (item.name && item.name.toLowerCase().includes(q)) || (item.shortName && item.shortName.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // Логика фильтрации брони для целевых категорий
      if (categorySlug === 'armor' || categorySlug === 'helmets' || categorySlug === 'rigs') {
        const itemClass = Number(item.properties?.class) || 0;
        if (itemClass > 0 && !activeArmorClasses.includes(itemClass)) {
          return false;
        }
      }

      return true;
    });

    data.sort((a, b) => {
      let aValue: any = 0;
      let bValue: any = 0;

      switch (sortConfig.key) {
        case 'name': aValue = a.name || ''; bValue = b.name || ''; break;
        case 'sellTrader': aValue = a.eco.bestTraderSell.price; bValue = b.eco.bestTraderSell.price; break;
        case 'sellFlea': aValue = a.eco.fleaSell?.price || 0; bValue = b.eco.fleaSell?.price || 0; break;
        case 'buyFlea': aValue = a.eco.fleaBuy?.price || 0; bValue = b.eco.fleaBuy?.price || 0; break;
        case 'buyMin': aValue = a.eco.minPrice; bValue = b.eco.minPrice; break;
        case 'vps': aValue = a.eco.vps; bValue = b.eco.vps; break;
        case 'size': aValue = a.eco.slots; bValue = b.eco.slots; break;
        case 'ambientVolume': aValue = a.properties?.ambientVolume || 0; bValue = b.properties?.ambientVolume || 0; break;
        case 'class': aValue = Number(a.properties?.class) || 0; bValue = Number(b.properties?.class) || 0; break;
        case 'durability': aValue = Number(a.properties?.durability) || 0; bValue = Number(b.properties?.durability) || 0; break;
        case 'damage': aValue = Number(a.properties?.damage) || 0; bValue = Number(b.properties?.damage) || 0; break;
        case 'penetration': aValue = Number(a.properties?.penetrationPower) || 0; bValue = Number(b.properties?.penetrationPower) || 0; break;
        case 'armorDamage': aValue = Number(a.properties?.armorDamage) || 0; bValue = Number(b.properties?.armorDamage) || 0; break;
        case 'fragmentation': aValue = Number(a.properties?.fragmentationChance) || 0; bValue = Number(b.properties?.fragmentationChance) || 0; break;
        case 'ergonomics': aValue = Number(a.properties?.ergonomics) || 0; bValue = Number(b.properties?.ergonomics) || 0; break;
        case 'recoil': aValue = Number(a.properties?.recoilModifier) || 0; bValue = Number(b.properties?.recoilModifier) || 0; break;
        case 'deafening': aValue = a.properties?.deafening || ''; bValue = b.properties?.deafening || ''; break;
        case 'blocksHeadset': aValue = (a.properties?.blocksEarpiece || a.properties?.blocksHeadset) ? 1 : 0; bValue = (b.properties?.blocksEarpiece || b.properties?.blocksHeadset) ? 1 : 0; break;
        case 'caliber': aValue = a.properties?.caliber || ''; bValue = b.properties?.caliber || ''; break;
        default: aValue = a.eco.vps; bValue = b.eco.vps; break;
      }

      // Сортировка для строк (по алфавиту)
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      // Сортировка для чисел
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [initialData, searchQuery, sortConfig, categorySlug, activeArmorClasses]);

  // Вспомогательный рендер заголовка-сортировки
  const renderSortableHeader = (label: string, sortKey: string, align: 'left' | 'center' | 'right' = 'left', customClass: string = '') => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        scope="col" 
        className={`px-4 py-3 text-[10px] font-blender-medium uppercase tracking-widest cursor-pointer hover:bg-card-menu/80 transition-colors group select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${isActive ? 'text-[var(--primary)] bg-card-menu/30' : 'text-text-muted'} ${customClass}`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          {label}
          <span className="w-3 h-3 flex items-center justify-center">
            {isActive ? (
              sortConfig.direction === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

  // Вспомогательный рендер цен с обработкой состояния "Не продается / Запрещено к продаже"
  const renderPrice = (price?: number, vendor?: { name: string; normalizedName?: string }, highlightGreen = false) => {
    if (!price || price <= 0) {
      return (
        <div className="flex items-center justify-end gap-1 text-[var(--color-text-muted)] opacity-50" title="Недоступно / Нет в продаже">
          <PackageX className="w-3 h-3" />
          <span className="font-blender-medium text-[9px] uppercase tracking-widest">Нет</span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-end gap-1.5">
        <span className={`font-mono font-bold ${highlightGreen ? 'text-[var(--color-nvg-green)]' : 'text-[var(--color-text-primary)]'}`}>{price.toLocaleString('ru-RU')} ₽</span>
        {vendor && <VendorIcon vendor={vendor} />}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* ТАКТИЧЕСКАЯ ПАНЕЛЬ УПРАВЛЕНИЯ */}
      <div className="bg-card-menu border border-lines-hover p-4 rounded flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between shadow-lg w-full">
        
        {/* Поиск */}
        <div className="relative flex items-center bg-[#0D0D0F] border border-lines-hover rounded h-10 px-3 w-full xl:w-80 focus-within:border-[var(--primary)] transition-colors shrink-0">
          <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
          <input 
            type="text"
            placeholder="ФИЛЬТР ПРЕДМЕТОВ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[12px] font-blender-medium uppercase tracking-wider text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-text-muted hover:text-[var(--primary)] shrink-0 ml-2">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Контролы: Броня, Сортировка, Переключатель Видов */}
        <div className="flex flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto">
          
          {/* Опциональные фильтры брони */}
          {(categorySlug === 'armor' || categorySlug === 'helmets' || categorySlug === 'rigs') && (
            <div className="flex items-center gap-3 animate-[fade-in-up_0.3s_ease-out]">
              <span className="font-blender-medium text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] hidden sm:inline-block">
                Класс брони
              </span>
              <div className="flex flex-wrap items-center gap-1 border-lines-hover rounded p-1">
                {[1, 2, 3, 4, 5, 6].map((ac) => {
                  const isActive = activeArmorClasses.includes(ac);
                  return (
                    <button
                      key={ac}
                      onClick={() => setActiveArmorClasses(prev => prev.includes(ac) ? prev.filter(c => c !== ac) : [...prev, ac])}
                      title={`Показать/Скрыть класс брони ${ac}`}
                      className={`flex h-7 w-7 items-center justify-center rounded transition-all duration-300 ${
                        isActive 
                          ? "bg-[var(--primary)] text-[var(--color-base)] drop-shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_40%,transparent)]" 
                          : "bg-transparent text-[var(--color-text-muted)] hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <span className={`h-5 w-5 bg-current [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center] icon-eft-armor-class-${ac}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(categorySlug === 'armor' || categorySlug === 'helmets' || categorySlug === 'rigs') && (
            <div className="w-[1px] h-6 bg-lines-hover mx-1 hidden lg:block" />
          )}

          {/* Сортировка */}
          <div className="flex items-center bg-[#0D0D0F] border border-lines-hover rounded h-10 px-3 grow sm:grow-0">
            <ArrowDownUp className="w-4 h-4 text-text-muted mr-2 shrink-0" />
            <select 
              value={sortConfig.key} 
              onChange={(e) => setSortConfig({ key: e.target.value, direction: e.target.value === 'name' ? 'asc' : 'desc' })}
              className="bg-transparent text-text-secondary text-[12px] font-blender-medium uppercase tracking-wider focus:outline-none cursor-pointer w-full"
            >
              <option value="vps">По выгоде (VPS)</option>
              <option value="sellTrader">Продажа (Торговец)</option>
              <option value="sellFlea">Продажа (Барахолка)</option>
              <option value="buyMin">Покупка (Мин. цена)</option>
              <option value="name">По алфавиту</option>
            </select>
          </div>

          <div className="w-[1px] h-6 bg-lines-hover mx-1 hidden sm:block" />

          {/* Переключатель видов */}
          <div className="flex items-center gap-1 bg-[#0D0D0F] border border-lines-hover rounded p-1 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${viewMode === 'grid' ? 'bg-[var(--primary)] text-[var(--color-base)] shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_40%,transparent)]' : 'text-text-muted hover:text-text-primary hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)]'}`}
              title="Сетка"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${viewMode === 'table' ? 'bg-[var(--primary)] text-[var(--color-base)] shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_40%,transparent)]' : 'text-text-muted hover:text-text-primary hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)]'}`}
              title="Список"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ПУСТОЙ СТЕЙТ (Graceful Degradation) */}
      {!isLoading && processedItems.length === 0 && (
        <div className="relative flex w-full h-[400px] flex-col items-center justify-center overflow-hidden rounded-lg border border-[var(--color-lines-hover)] bg-[var(--color-card-menu)] shadow-lg animate-[fade-in-up_0.5s_ease-out]">
          <div className="pointer-events-none absolute inset-0 opacity-10 bg-hazard-pattern animate-hazard" />
          <div className="relative z-10 flex flex-col items-center text-center px-4">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-lines-hover)] bg-[var(--color-base)] shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <PackageX className="h-8 w-8 text-[var(--color-text-muted)]" />
            </div>
            <h3 className="mb-2 font-blender-medium text-xl uppercase tracking-widest text-[var(--color-text-primary)]">
              Данные не найдены
            </h3>
            <p className="mb-8 max-w-md font-mono text-xs text-[var(--color-text-secondary)]">
              База данных пуста или запрос не дал результатов. Попробуйте изменить параметры фильтрации или строку поиска.
            </p>
            <button 
              onClick={() => {
                setSearchQuery("");
                setActiveArmorClasses([1, 2, 3, 4, 5, 6]);
              }}
              className="group relative inline-flex items-center justify-center overflow-hidden rounded border border-[var(--color-lines-hover)] bg-[var(--color-base)] px-8 py-2 transition-all duration-300 hover:border-[var(--primary)] hover:shadow-[0_0_15px_color-mix(in_srgb,var(--primary)_20%,transparent)]"
            >
              <div className="absolute inset-0 w-0 bg-[var(--primary)] opacity-10 transition-all duration-300 ease-out group-hover:w-full" />
              <span className="relative z-10 font-blender-medium text-[13px] uppercase tracking-widest text-[var(--color-text-secondary)] transition-colors duration-300 group-hover:text-[var(--primary)]">
                Сбросить фильтры
              </span>
            </button>
          </div>
        </div>
      )}

      {/* SKELETON (Состояние начальной загрузки) */}
      {isLoading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-[fade-in-up_0.3s_ease-out]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="tactical-card-base p-4 flex flex-col h-[250px] animate-pulse border-lines-hover">
              <div className="flex justify-between items-start mb-4">
                <div className="h-5 w-24 bg-lines-hover/50 rounded"></div>
                <div className="h-3 w-12 bg-lines-hover/30 rounded"></div>
              </div>
              <div className="w-full h-24 mb-4 bg-lines-hover/30 rounded-sm"></div>
              <div className="h-5 w-3/4 bg-lines-hover/50 rounded mb-3"></div>
              <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-lines-hover/50">
                <div className="h-8 w-full bg-lines-hover/30 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && viewMode === 'table' && (
        <div className="overflow-x-auto border border-lines-hover rounded-lg bg-card-menu/20 animate-[fade-in-up_0.3s_ease-out]">
          <table className="w-full text-sm text-left whitespace-nowrap font-blender-book">
            <thead className="bg-card-menu/50 border-b border-lines-hover">
              <tr>
                <th className="px-4 py-3 h-10 w-16 border-r border-lines-hover/50"></th>
                <th className="px-4 py-3 h-10 w-[160px] sm:w-[220px] md:w-[280px] lg:w-[320px] xl:w-[400px]"></th>
                <th className="px-4 py-3 h-10"></th>
                <th className="px-4 py-3 h-10"></th>
                <th className="px-4 py-3 h-10"></th>
                <th className="px-4 py-3 h-10"></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 15 }).map((_, i) => (
                <tr key={i} className="border-b border-lines-hover last:border-0 animate-pulse">
                  <td className="px-4 py-2 border-r border-lines-hover/50">
                    <div className="w-12 h-12 bg-lines-hover/50 rounded-sm mx-auto"></div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <div className="h-4 w-3/4 bg-lines-hover/50 rounded"></div>
                      <div className="h-3 w-1/2 bg-lines-hover/30 rounded"></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><div className="h-4 w-12 bg-lines-hover/50 rounded mx-auto"></div></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-lines-hover/50 rounded ml-auto"></div></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-lines-hover/50 rounded ml-auto"></div></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-lines-hover/50 rounded ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ВИД 1: СЕТКА (GRID) */}
      {!isLoading && viewMode === 'grid' && processedItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {processedItems.map((item) => (
            <ItemTile key={item.id} item={item} categorySlug={categorySlug} />
          ))}
        </div>
      )}

      {/* ВИД 2: ТАБЛИЦА (LIST) */}
      {!isLoading && viewMode === 'table' && processedItems.length > 0 && (
        <div className="overflow-x-auto border border-lines-hover rounded-lg bg-card-menu/20">
          <table className="w-full text-sm text-left whitespace-nowrap font-blender-book">
            <thead className="bg-card-menu/50 border-b border-lines-hover">
              <tr>
                <th scope="col" className="px-4 py-3 text-[10px] font-blender-medium text-text-muted uppercase tracking-widest w-16 text-center border-r border-lines-hover/50">Визуал</th>
                {renderSortableHeader('Предмет', 'name', 'left', 'w-[160px] max-w-[160px] sm:w-[220px] sm:max-w-[220px] md:w-[280px] md:max-w-[280px] lg:w-[320px] lg:max-w-[320px] xl:w-[400px] xl:max-w-[400px]')}
                
                {categorySlug === 'headphones' ? (
                  <>
                    {renderSortableHeader('Дистанция', 'ambientVolume', 'center')}
                    {renderSortableHeader('Покупка (Барахолка)', 'buyFlea', 'right')}
                    {renderSortableHeader('Продажа (Торговец)', 'sellTrader', 'right')}
                    {renderSortableHeader('Продажа (Барахолка)', 'sellFlea', 'right')}
                    {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                  </>
                ) : categorySlug === 'helmets' ? (
                  <>
                    {renderSortableHeader('Класс', 'class', 'center')}
                    {renderSortableHeader('Шум', 'deafening', 'center')}
                    {renderSortableHeader('Наушники', 'blocksHeadset', 'center')}
                    {renderSortableHeader('Прочн.', 'durability', 'center')}
                    {renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}
                    {renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}
                    {renderSortableHeader('Купить (Мин.)', 'buyMin', 'right')}
                  </>
                ) : categorySlug === 'ammo' ? (
                  <>
                    {renderSortableHeader('Калибр', 'caliber', 'center')}
                    {renderSortableHeader('Урон', 'damage', 'center')}
                    {renderSortableHeader('Пробитие', 'penetration', 'center')}
                    {renderSortableHeader('Урон броне', 'armorDamage', 'center')}
                    {renderSortableHeader('Фрагм.', 'fragmentation', 'center')}
                    {renderSortableHeader('Покупка', 'buyMin', 'right')}
                  </>
                ) : ['pistolgrips', 'muzzle', 'sights', 'auxiliary', 'foregrips', 'stocks', 'handguards'].includes(categorySlug || '') ? (
                  <>
                    {renderSortableHeader('Эргономика', 'ergonomics', 'center')}
                    {renderSortableHeader('Отдача', 'recoil', 'center')}
                    {renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}
                    {renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}
                    {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                  </>
                ) : (
                  <>
                    {renderSortableHeader('Размер', 'size', 'center', 'w-24')}
                    {renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}
                    {renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}
                    {renderSortableHeader('Купить (Мин.)', 'buyMin', 'right')}
                    {renderSortableHeader('Выгода / Слот', 'vps', 'right')}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {processedItems.map((item) => (
                <tr key={item.id} className="border-b border-lines-hover last:border-0 hover:bg-card-menu/30 transition-colors group">
                  <td className="px-4 py-2 border-r border-lines-hover/50">
                    <div className="relative w-12 h-12 mx-auto bg-gradient-to-b from-[#2c2c2c] to-[#121212] border border-[#444] shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={`/images/items/eft/${item.id}.webp`} 
                        alt={item.name} 
                        className="absolute inset-0 w-full h-full object-contain p-1 group-hover:scale-110 transition-transform" 
                        onError={(e) => {
                          if (!e.currentTarget.dataset.triedApi) {
                            e.currentTarget.dataset.triedApi = 'true';
                            e.currentTarget.src = item.image512pxLink || '/images/placeholder.webp';
                          } else if (!e.currentTarget.dataset.triedPlaceholder) {
                            e.currentTarget.dataset.triedPlaceholder = 'true';
                            e.currentTarget.src = '/images/placeholder.webp';
                          }
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 w-[160px] max-w-[160px] sm:w-[220px] sm:max-w-[220px] md:w-[280px] md:max-w-[280px] lg:w-[320px] lg:max-w-[320px] xl:w-[400px] xl:max-w-[400px]">
                    <Link href={`/eft/items/item/${item.id}`} className="flex min-w-0 w-full flex-col overflow-hidden transition-colors group-hover:text-[var(--primary)]">
                      <span className="block w-full truncate font-blender-medium text-base uppercase leading-none" title={item.name}>{item.name}</span>
                      <span className="mt-1 block w-full truncate font-mono text-xs text-[var(--color-text-secondary)]" title={item.shortName}>{item.shortName}</span>
                    </Link>
                  </td>
                  
                  {categorySlug === 'headphones' ? (
                    <>
                      <td className="px-4 py-3 text-center">
                        <SemanticBadge color="gray" label={item.properties?.ambientVolume ? `${item.properties.ambientVolume} dB` : 'Н/Д'} className="w-fit mx-auto" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.fleaBuy?.price, item.eco.fleaBuy?.vendor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.minPrice, item.eco.bestBuy?.vendor, true)}
                      </td>
                    </>
                  ) : categorySlug === 'helmets' ? (
                    <>
                      <td className="px-4 py-3 text-center">
                        <SemanticBadge 
                          color={getArmorClassColor(item.properties?.class || 0)} 
                          label={`Класс ${item.properties?.class || '?'}`} 
                          iconClass={item.properties?.class ? `icon-eft-armor-class-${item.properties.class}` : undefined} 
                          iconSizeClass="w-[22px] h-[22px]" 
                          className="w-fit mx-auto" 
                        />
                      </td>
                      <td className="px-4 py-3 text-center text-[var(--color-text-secondary)] text-[10px] font-blender-medium uppercase">
                        {item.properties?.deafening || 'Н/Д'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(item.properties?.blocksEarpiece || item.properties?.blocksHeadset) ? <SemanticBadge color="red" label="Блок." title="Блокирует наушники" className="w-fit mx-auto" /> : <span className="text-[var(--color-nvg-green)] font-blender-medium text-xs uppercase opacity-80">Нет</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-[var(--color-text-primary)]">{item.properties?.durability || 'Н/Д'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.minPrice, item.eco.bestBuy?.vendor, true)}
                      </td>
                    </>
                  ) : categorySlug === 'ammo' ? (
                    <>
                      <td className="px-4 py-3 text-center text-[var(--color-text-secondary)] font-mono text-[10px]">{item.properties?.caliber?.replace('Caliber', '') || '—'}</td>
                      <td className="px-4 py-3">
                        <SemanticBadge color="red" label={item.properties?.damage?.toString() || '—'} className="w-fit mx-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <SemanticBadge color="emerald" label={item.properties?.penetrationPower?.toString() || '—'} className="w-fit mx-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <SemanticBadge color="gray" label={item.properties?.armorDamage ? `${item.properties.armorDamage}%` : '—'} className="w-fit mx-auto" />
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const frag = Number(item.properties?.fragmentationChance) || 0;
                          const pen = Number(item.properties?.penetrationPower) || 0;
                          const isBlocked = pen < 20;
                          return <SemanticBadge color={isBlocked ? "gray" : "amber"} label={isBlocked ? "Блок." : `${Math.round(frag * 100)}%`} isStrike={isBlocked} title={isBlocked ? "Фрагментация невозможна из-за пробития < 20" : "Шанс фрагментации"} className="w-fit mx-auto" />;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.minPrice, item.eco.bestBuy?.vendor, true)}
                      </td>
                    </>
                  ) : ['pistolgrips', 'muzzle', 'sights', 'auxiliary', 'foregrips', 'stocks', 'handguards'].includes(categorySlug || '') ? (
                    <>
                      <td className="px-4 py-3 text-center font-mono text-[var(--color-nvg-green)]">
                        {item.properties?.ergonomics ? `+${item.properties.ergonomics}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-text-secondary">
                        {item.properties?.recoilModifier ? `${(item.properties.recoilModifier * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.minPrice, item.eco.bestBuy?.vendor, true)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-text-muted font-mono">{item.width}x{item.height}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {renderPrice(item.eco.minPrice, item.eco.bestBuy?.vendor, true)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.eco.vps > 0 ? (
                          <span className={`font-mono font-bold ${item.eco.vps > 10000 ? 'text-[var(--color-nvg-green)]' : item.eco.vps > 5000 ? 'text-yellow-500' : 'text-[var(--color-text-primary)]'}`}>{item.eco.vps.toLocaleString('ru-RU')} ₽</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1 text-[var(--color-text-muted)] opacity-50"><PackageX className="w-3 h-3" /><span className="font-blender-medium text-[9px] uppercase tracking-widest">Нет</span></div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}