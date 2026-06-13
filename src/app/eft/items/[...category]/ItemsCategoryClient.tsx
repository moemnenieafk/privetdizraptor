"use client";

import React, { useMemo, useRef, memo, forwardRef } from 'react';
import Link from 'next/link';
import { PackageX, Coins, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge as SemanticBadge, getArmorClassColor } from '@/components/features/items/Badge';
import { ItemTile } from '@/components/features/items/ItemTile';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { useCategoryFilters } from '@/components/features/items/useCategoryFilters';
import { CategoryControlBar } from '@/components/features/items/CategoryControlBar';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryItem {
  id: string;
  name: string;
  shortName: string;
  width: number;
  height: number;
  backgroundColor?: string;
  basePrice: number;
  image512pxLink: string;
  types?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: any;
  sellFor: { price: number; vendor: { name: string; normalizedName?: string } }[];
  buyFor: { price: number; vendor: { name: string; normalizedName?: string } }[];
}

interface ItemsCategoryClientProps {
  initialData: CategoryItem[];
  categorySlug?: string;
}

// ─── Economics helper ─────────────────────────────────────────────────────────

function getEconomics(item: CategoryItem) {
  const slots = item.width * item.height || 1;
  const isFlea = (v: { vendor: { name: string; normalizedName?: string } }) =>
    v.vendor.name === 'Flea Market' || v.vendor.normalizedName === 'flea-market';

  const fleaBuy = item.buyFor?.find(isFlea);
  const fleaSell = item.sellFor?.find(isFlea);
  const traderSells = item.sellFor?.filter(s => !isFlea(s)) || [];
  const bestTraderSell = traderSells.length
    ? traderSells.reduce((max, curr) => curr.price > max.price ? curr : max, traderSells[0])
    : { price: 0, vendor: { name: '-' } };
  const bestSell = item.sellFor?.length
    ? item.sellFor.reduce((max, curr) => curr.price > max.price ? curr : max, item.sellFor[0])
    : { price: 0, vendor: { name: '-' } };
  const bestBuy = item.buyFor?.length
    ? item.buyFor.reduce((min, curr) => curr.price < min.price ? curr : min, item.buyFor[0])
    : { price: 0, vendor: { name: '-' } };

  return {
    slots,
    bestSell,
    bestBuy,
    vps: slots > 0 ? Math.floor(bestSell.price / slots) : 0,
    fleaBuy,
    fleaSell,
    bestTraderSell,
    minPrice: bestBuy.price || 0,
  };
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function VendorIcon({ vendor }: { vendor: { name: string; normalizedName?: string } }) {
  if (!vendor || vendor.name === '-') return null;
  if (vendor.name === 'Flea Market' || vendor.normalizedName === 'flea-market') {
    return <Coins className="w-4 h-4 text-yellow-500 shrink-0" />;
  }
  if (!vendor.normalizedName) return <span className="w-4 h-4 shrink-0" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/images/traders/eft/${vendor.normalizedName}.webp`} alt={vendor.name} className="w-4 h-4 object-cover rounded-sm shrink-0" title={vendor.name} />;
}

type ProcessedItem = CategoryItem & { eco: ReturnType<typeof getEconomics> };

function renderPrice(price?: number, vendor?: { name: string; normalizedName?: string }, highlightGreen = false) {
  if (!price || price <= 0) {
    return (
      <div className="flex items-center justify-end gap-1 text-text-muted opacity-50" title="Недоступно / Нет в продаже">
        <PackageX className="w-3 h-3" />
        <span className="font-blender-medium text-[9px] uppercase tracking-widest">Нет</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1.5">
      <span className={`font-mono font-bold ${highlightGreen ? 'text-nvg-green' : 'text-text-primary'}`}>
        {price.toLocaleString('ru-RU')} ₽
      </span>
      {vendor && <VendorIcon vendor={vendor} />}
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

const CategoryTableRow = memo(forwardRef<
  HTMLTableRowElement,
  { item: ProcessedItem; categorySlug?: string } & React.HTMLAttributes<HTMLTableRowElement>
>(function CategoryTableRow({ item, categorySlug, ...props }, ref) {
  return (
    <tr ref={ref} {...props} className="border-b border-lines-hover last:border-0 hover:bg-card-menu/30 transition-colors group">
      <td className="px-4 py-2 border-r border-lines-hover/50">
        <div className="relative w-12 h-12 mx-auto bg-linear-to-b from-lines-hover to-(--color-base) border border-lines-hover shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/images/items/eft/${item.id}.webp`}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 z-10 w-full h-full object-contain p-1 group-hover:scale-110 transition-transform"
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
        <Link href={`/eft/items/item/${item.id}`} className="flex min-w-0 w-full flex-col overflow-hidden transition-colors group-hover:text-(--primary)">
          <span className="block w-full truncate font-blender-medium text-base uppercase leading-none" title={item.name}>{item.name}</span>
          <span className="mt-1 block w-full truncate font-mono text-xs text-text-secondary" title={item.shortName}>{item.shortName}</span>
        </Link>
      </td>

      {categorySlug === 'headphones' ? (
        <>
          <td className="px-4 py-3 text-center">
            <SemanticBadge color="gray" label={item.properties?.ambientVolume ? `${item.properties.ambientVolume} dB` : 'Н/Д'} className="w-fit mx-auto" />
          </td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.fleaBuy?.price, item.eco.fleaBuy?.vendor)}</td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor)}</td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor)}</td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.minPrice, item.eco.bestBuy?.vendor, true)}</td>
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
          <td className="px-4 py-3 text-center text-text-secondary text-[10px] font-blender-medium uppercase">{item.properties?.deafening || 'Н/Д'}</td>
          <td className="px-4 py-3 text-center">
            {(item.properties?.blocksEarpiece || item.properties?.blocksHeadset)
              ? <SemanticBadge color="red" label="Блок." title="Блокирует наушники" className="w-fit mx-auto" />
              : <span className="text-nvg-green font-blender-medium text-xs uppercase opacity-80">Нет</span>}
          </td>
          <td className="px-4 py-3 text-center"><span className="font-mono text-text-primary">{item.properties?.durability || 'Н/Д'}</span></td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor)}</td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor)}</td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.minPrice, item.eco.bestBuy?.vendor, true)}</td>
        </>
      ) : categorySlug === 'ammo' ? (
        <>
          <td className="px-4 py-3 text-center text-text-secondary font-mono text-[10px]">{item.properties?.caliber?.replace('Caliber', '') || '—'}</td>
          <td className="px-4 py-3"><SemanticBadge color="red" label={item.properties?.damage?.toString() || '—'} className="w-fit mx-auto" /></td>
          <td className="px-4 py-3"><SemanticBadge color="emerald" label={item.properties?.penetrationPower?.toString() || '—'} className="w-fit mx-auto" /></td>
          <td className="px-4 py-3"><SemanticBadge color="gray" label={item.properties?.armorDamage ? `${item.properties.armorDamage}%` : '—'} className="w-fit mx-auto" /></td>
          <td className="px-4 py-3">
            {(() => {
              const frag = Number(item.properties?.fragmentationChance) || 0;
              const pen = Number(item.properties?.penetrationPower) || 0;
              const isBlocked = pen < 20;
              return <SemanticBadge color={isBlocked ? "gray" : "amber"} label={isBlocked ? "Блок." : `${Math.round(frag * 100)}%`} isStrike={isBlocked} title={isBlocked ? "Фрагментация невозможна из-за пробития < 20" : "Шанс фрагментации"} className="w-fit mx-auto" />;
            })()}
          </td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.minPrice, item.eco.bestBuy?.vendor, true)}</td>
        </>
      ) : ['pistolgrips', 'muzzle', 'sights', 'auxiliary', 'foregrips', 'stocks', 'handguards'].includes(categorySlug || '') ? (
        <>
          <td className="px-4 py-3 text-center font-mono text-nvg-green">{item.properties?.ergonomics ? `+${item.properties.ergonomics}` : '—'}</td>
          <td className="px-4 py-3 text-center font-mono text-text-secondary">{item.properties?.recoilModifier ? `${(item.properties.recoilModifier * 100).toFixed(1)}%` : '—'}</td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor)}</td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor)}</td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.minPrice, item.eco.bestBuy?.vendor, true)}</td>
        </>
      ) : (
        <>
          <td className="px-4 py-3 text-center"><span className="text-xs text-text-muted font-mono">{item.width}x{item.height}</span></td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor)}</td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor)}</td>
          <td className="px-4 py-3 text-right">{renderPrice(item.eco.minPrice, item.eco.bestBuy?.vendor, true)}</td>
          <td className="px-4 py-3 text-right">
            {item.eco.vps > 0 ? (
              <span className={`font-mono font-bold ${item.eco.vps > 10000 ? 'text-nvg-green' : item.eco.vps > 5000 ? 'text-yellow-500' : 'text-text-primary'}`}>
                {item.eco.vps.toLocaleString('ru-RU')} ₽
              </span>
            ) : (
              <div className="flex items-center justify-end gap-1 text-text-muted opacity-50">
                <PackageX className="w-3 h-3" /><span className="font-blender-medium text-[9px] uppercase tracking-widest">Нет</span>
              </div>
            )}
          </td>
        </>
      )}
    </tr>
  );
}));

// ─── Main component ───────────────────────────────────────────────────────────

export function ItemsCategoryClient({ initialData, categorySlug }: ItemsCategoryClientProps) {
  const {
    viewMode, setViewMode,
    searchQuery, setSearchQuery,
    sortConfig,
    activeArmorClasses,
    isLoading,
    barterOnly, setBarterOnly,
    availableOnly, setAvailableOnly,
    isSaved,
    handleColumnSort,
    handleDropdownSort,
    toggleArmorClass,
    handleSaveFilters,
    resetFilters,
  } = useCategoryFilters();

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const processedItems = useMemo(() => {
    let data = initialData.map(item => ({ ...item, eco: getEconomics(item) }));

    data = data.filter(item => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!(item.name?.toLowerCase().includes(q) || item.shortName?.toLowerCase().includes(q))) return false;
      }
      if ((categorySlug === 'armor' || categorySlug === 'helmets' || categorySlug === 'rigs')) {
        const itemClass = Number(item.properties?.class) || 0;
        if (itemClass > 0 && !activeArmorClasses.includes(itemClass)) return false;
      }
      if (barterOnly && (!item.types || !item.types.includes('barter'))) return false;
      return true;
    });

    data.sort((a, b) => {
      let aValue: string | number = 0;
      let bValue: string | number = 0;

      switch (sortConfig.key) {
        case 'name':          aValue = a.name || ''; bValue = b.name || ''; break;
        case 'sellTrader':    aValue = a.eco.bestTraderSell.price; bValue = b.eco.bestTraderSell.price; break;
        case 'sellFlea':      aValue = a.eco.fleaSell?.price || 0; bValue = b.eco.fleaSell?.price || 0; break;
        case 'buyFlea':       aValue = a.eco.fleaBuy?.price || 0; bValue = b.eco.fleaBuy?.price || 0; break;
        case 'buyMin':        aValue = a.eco.minPrice; bValue = b.eco.minPrice; break;
        case 'vps':           aValue = a.eco.vps; bValue = b.eco.vps; break;
        case 'size':          aValue = a.eco.slots; bValue = b.eco.slots; break;
        case 'ambientVolume': aValue = a.properties?.ambientVolume || 0; bValue = b.properties?.ambientVolume || 0; break;
        case 'class':         aValue = Number(a.properties?.class) || 0; bValue = Number(b.properties?.class) || 0; break;
        case 'durability':    aValue = Number(a.properties?.durability) || 0; bValue = Number(b.properties?.durability) || 0; break;
        case 'damage':        aValue = Number(a.properties?.damage) || 0; bValue = Number(b.properties?.damage) || 0; break;
        case 'penetration':   aValue = Number(a.properties?.penetrationPower) || 0; bValue = Number(b.properties?.penetrationPower) || 0; break;
        case 'armorDamage':   aValue = Number(a.properties?.armorDamage) || 0; bValue = Number(b.properties?.armorDamage) || 0; break;
        case 'fragmentation': aValue = Number(a.properties?.fragmentationChance) || 0; bValue = Number(b.properties?.fragmentationChance) || 0; break;
        case 'ergonomics':    aValue = Number(a.properties?.ergonomics) || 0; bValue = Number(b.properties?.ergonomics) || 0; break;
        case 'recoil':        aValue = Number(a.properties?.recoilModifier) || 0; bValue = Number(b.properties?.recoilModifier) || 0; break;
        case 'deafening':     aValue = a.properties?.deafening || ''; bValue = b.properties?.deafening || ''; break;
        case 'blocksHeadset': aValue = (a.properties?.blocksEarpiece || a.properties?.blocksHeadset) ? 1 : 0; bValue = (b.properties?.blocksEarpiece || b.properties?.blocksHeadset) ? 1 : 0; break;
        case 'caliber':       aValue = a.properties?.caliber || ''; bValue = b.properties?.caliber || ''; break;
        default:              aValue = a.eco.vps; bValue = b.eco.vps; break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [initialData, searchQuery, sortConfig, categorySlug, activeArmorClasses, barterOnly]);

  const renderSortableHeader = (label: string, sortKey: string, align: 'left' | 'center' | 'right' = 'left', customClass = '') => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th
        scope="col"
        className={`px-4 py-3 text-[10px] font-blender-medium uppercase tracking-widest cursor-pointer hover:bg-card-menu/80 transition-colors group select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${isActive ? 'text-(--primary) bg-card-menu/30' : 'text-text-muted'} ${customClass}`}
        onClick={() => handleColumnSort(sortKey)}
      >
        <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          {label}
          <span className="w-3 h-3 flex items-center justify-center">
            {isActive
              ? (sortConfig.direction === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
              : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />}
          </span>
        </div>
      </th>
    );
  };

  const tableVirtualizer = useVirtualizer({
    count: !isLoading && viewMode === 'table' ? processedItems.length : 0,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 57,
    overscan: 8,
  });
  const virtualTableRows = tableVirtualizer.getVirtualItems();
  const tablePaddingTop = virtualTableRows.length > 0 ? virtualTableRows[0].start : 0;
  const tablePaddingBottom = virtualTableRows.length > 0
    ? tableVirtualizer.getTotalSize() - virtualTableRows[virtualTableRows.length - 1].end
    : 0;

  return (
    <div className="w-full flex flex-col gap-6">

      <CategoryControlBar
        categorySlug={categorySlug}
        searchQuery={searchQuery}
        sortConfig={sortConfig}
        activeArmorClasses={activeArmorClasses}
        barterOnly={barterOnly}
        availableOnly={availableOnly}
        viewMode={viewMode}
        isSaved={isSaved}
        onSearchChange={setSearchQuery}
        onDropdownSort={handleDropdownSort}
        onArmorClassToggle={toggleArmorClass}
        onBarterOnlyChange={setBarterOnly}
        onAvailableOnlyChange={setAvailableOnly}
        onViewModeChange={setViewMode}
        onSaveFilters={handleSaveFilters}
      />

      {/* Пустой стейт */}
      {!isLoading && processedItems.length === 0 && (
        <div className="relative flex w-full h-[400px] flex-col items-center justify-center overflow-hidden rounded-lg border border-lines-hover bg-card-menu shadow-lg animate-[fade-in-up_0.5s_ease-out]">
          <div className="pointer-events-none absolute inset-0 opacity-10 bg-hazard-pattern animate-hazard" />
          <div className="relative z-10 flex flex-col items-center text-center px-4">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-lines-hover bg-(--color-base) shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <PackageX className="h-8 w-8 text-text-muted" />
            </div>
            <h3 className="mb-2 font-blender-medium text-xl uppercase tracking-widest text-text-primary">Данные не найдены</h3>
            <p className="mb-8 max-w-md font-mono text-xs text-text-secondary">
              База данных пуста или запрос не дал результатов. Попробуйте изменить параметры фильтрации или строку поиска.
            </p>
            <button
              onClick={resetFilters}
              className="group relative inline-flex items-center justify-center overflow-hidden rounded border border-lines-hover bg-(--color-base) px-8 py-2 transition-all duration-300 hover:border-(--primary) hover:shadow-[0_0_15px_color-mix(in_srgb,var(--primary)_20%,transparent)]"
            >
              <div className="absolute inset-0 w-0 bg-(--primary) opacity-10 transition-all duration-300 ease-out group-hover:w-full" />
              <span className="relative z-10 font-blender-medium text-[13px] uppercase tracking-widest text-text-secondary transition-colors duration-300 group-hover:text-(--primary)">
                Сбросить фильтры
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Skeleton — сетка */}
      {isLoading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-[fade-in-up_0.3s_ease-out]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="tactical-card-base p-4 flex flex-col h-[250px] animate-pulse border-lines-hover">
              <div className="flex justify-between items-start mb-4">
                <div className="h-5 w-24 bg-lines-hover/50 rounded" />
                <div className="h-3 w-12 bg-lines-hover/30 rounded" />
              </div>
              <div className="w-full h-24 mb-4 bg-lines-hover/30 rounded-sm" />
              <div className="h-5 w-3/4 bg-lines-hover/50 rounded mb-3" />
              <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-lines-hover/50">
                <div className="h-8 w-full bg-lines-hover/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skeleton — таблица */}
      {isLoading && viewMode === 'table' && (
        <div className="overflow-x-auto border border-lines-hover rounded-lg bg-card-menu/20 animate-[fade-in-up_0.3s_ease-out]">
          <table className="w-full text-sm text-left whitespace-nowrap font-blender-book">
            <thead className="bg-card-menu/50 border-b border-lines-hover">
              <tr>
                {[16, 40, undefined, undefined, undefined, undefined].map((w, i) => (
                  <th key={i} className={`px-4 py-3 h-10${w ? ` w-${w}` : ''}${i === 1 ? ' border-r border-lines-hover/50' : ''}`} />
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 15 }).map((_, i) => (
                <tr key={i} className="border-b border-lines-hover last:border-0 animate-pulse">
                  <td className="px-4 py-2 border-r border-lines-hover/50">
                    <div className="w-12 h-12 bg-lines-hover/50 rounded-sm mx-auto" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <div className="h-4 w-3/4 bg-lines-hover/50 rounded" />
                      <div className="h-3 w-1/2 bg-lines-hover/30 rounded" />
                    </div>
                  </td>
                  <td className="px-4 py-3"><div className="h-4 w-12 bg-lines-hover/50 rounded mx-auto" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-lines-hover/50 rounded ml-auto" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-lines-hover/50 rounded ml-auto" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-lines-hover/50 rounded ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Вид: сетка */}
      {!isLoading && viewMode === 'grid' && processedItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {processedItems.map((item) => (
            <div key={item.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 300px' }}>
              <ItemTile item={item} categorySlug={categorySlug} />
            </div>
          ))}
        </div>
      )}

      {/* Вид: таблица */}
      {!isLoading && viewMode === 'table' && processedItems.length > 0 && (
        <div ref={tableContainerRef} className="overflow-auto max-h-[calc(100vh-260px)] border border-lines-hover rounded-lg bg-card-menu/20">
          <table className="w-full text-sm text-left whitespace-nowrap font-blender-book">
            <thead className="sticky top-0 z-10 bg-card-menu/95 backdrop-blur-sm border-b border-lines-hover">
              <tr>
                <th scope="col" className="px-4 py-3 text-[10px] font-blender-medium text-text-muted uppercase tracking-widest w-16 text-center border-r border-lines-hover/50">Визуал</th>
                {renderSortableHeader('Предмет', 'name', 'left', 'w-[160px] max-w-[160px] sm:w-[220px] sm:max-w-[220px] md:w-[280px] md:max-w-[280px] lg:w-[320px] lg:max-w-[320px] xl:w-[400px] xl:max-w-[400px]')}
                {categorySlug === 'headphones' ? (
                  <>{renderSortableHeader('Дистанция', 'ambientVolume', 'center')}{renderSortableHeader('Покупка (Барахолка)', 'buyFlea', 'right')}{renderSortableHeader('Продажа (Торговец)', 'sellTrader', 'right')}{renderSortableHeader('Продажа (Барахолка)', 'sellFlea', 'right')}{renderSortableHeader('Мин. цена', 'buyMin', 'right')}</>
                ) : categorySlug === 'helmets' ? (
                  <>{renderSortableHeader('Класс', 'class', 'center')}{renderSortableHeader('Шум', 'deafening', 'center')}{renderSortableHeader('Наушники', 'blocksHeadset', 'center')}{renderSortableHeader('Прочн.', 'durability', 'center')}{renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}{renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}{renderSortableHeader('Купить (Мин.)', 'buyMin', 'right')}</>
                ) : categorySlug === 'ammo' ? (
                  <>{renderSortableHeader('Калибр', 'caliber', 'center')}{renderSortableHeader('Урон', 'damage', 'center')}{renderSortableHeader('Пробитие', 'penetration', 'center')}{renderSortableHeader('Урон броне', 'armorDamage', 'center')}{renderSortableHeader('Фрагм.', 'fragmentation', 'center')}{renderSortableHeader('Покупка', 'buyMin', 'right')}</>
                ) : ['pistolgrips', 'muzzle', 'sights', 'auxiliary', 'foregrips', 'stocks', 'handguards'].includes(categorySlug || '') ? (
                  <>{renderSortableHeader('Эргономика', 'ergonomics', 'center')}{renderSortableHeader('Отдача', 'recoil', 'center')}{renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}{renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}{renderSortableHeader('Мин. цена', 'buyMin', 'right')}</>
                ) : (
                  <>{renderSortableHeader('Размер', 'size', 'center', 'w-24')}{renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}{renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}{renderSortableHeader('Купить (Мин.)', 'buyMin', 'right')}{renderSortableHeader('Выгода / Слот', 'vps', 'right')}</>
                )}
              </tr>
            </thead>
            <tbody>
              {tablePaddingTop > 0 && <tr><td style={{ height: tablePaddingTop }} colSpan={10} /></tr>}
              {virtualTableRows.map((virtualRow) => {
                const item = processedItems[virtualRow.index];
                return (
                  <CategoryTableRow
                    key={item.id}
                    item={item}
                    categorySlug={categorySlug}
                    data-index={virtualRow.index}
                    ref={tableVirtualizer.measureElement}
                  />
                );
              })}
              {tablePaddingBottom > 0 && <tr><td style={{ height: tablePaddingBottom }} colSpan={10} /></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast: фильтры сохранены */}
      {isSaved && (
        <div className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-100 flex items-center gap-3 rounded border border-lines-hover bg-[color-mix(in_srgb,var(--color-card-menu)_90%,transparent)] p-3 shadow-[0_8px_30px_rgba(0,0,0,0.8)] animate-[fade-in-up_0.3s_ease-out_both] backdrop-blur-md">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-nvg-green text-(--color-base) shadow-[0_0_10px_color-mix(in_srgb,var(--color-nvg-green)_40%,transparent)]">
            <Check className="h-5 w-5 stroke-3" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-blender-medium text-[13px] uppercase tracking-widest text-text-primary leading-none mb-1">Настройки сохранены</span>
            <span className="font-blender-book text-xs text-text-secondary leading-none">Текущие фильтры установлены по умолчанию</span>
          </div>
        </div>
      )}
    </div>
  );
}
