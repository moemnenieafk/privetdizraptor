"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

// Добавлен аргумент (lang: ru) прямо в запрос к API для получения русских названий
const AMMO_QUERY = `
{
  items(types: ammo, lang: ru) {
    id
    name
    shortName
    image512pxLink
    properties {
      ... on ItemPropertiesAmmo {
        damage
        penetrationPower
        caliber
      }
    }
    buyFor {
      price
      currency
      vendor { name }
      requirements {
        type
        value
      }
    }
  }
}
`;

type SortConfig = {
  key: 'name' | 'damage' | 'penetrationPower';
  direction: 'asc' | 'desc';
};

export default function AmmoPage() {
  const [ammo, setAmmo] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCaliber, setSelectedCaliber] = useState('ALL');
  const [onlyTraders, setOnlyTraders] = useState(false);
  const [selectedLL, setSelectedLL] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'penetrationPower', direction: 'desc' });

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('https://api.tarkov.dev/graphql', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ query: AMMO_QUERY }),
          cache: 'no-store'
        });
        const result = await response.json();
        if (result.data?.items) {
          const validAmmo = result.data.items.filter((i: any) => i.properties && typeof i.properties.damage === 'number');
          setAmmo(validAmmo);
        }
      } catch (e) { 
        console.error("Ошибка API:", e); 
      } finally { 
        setLoading(false); 
      }
    }
    fetchData();
  }, []);

  const formatCaliber = (cal: string) => {
    if (!cal) return 'Другой';
    const raw = cal.replace('Caliber', '').trim();
    const map: Record<string, string> = {
      '127x55': '12.7x55 мм', '12g': '12/70', '20g': '20/70', '366TKM': '.366 TKM',
      '40x46': '40x46 мм', '545x39': '5.45x39 мм', '556x45': '5.56x45 мм NATO',
      '762x25': '7.62x25 мм TT', '762x39': '7.62x39 мм', '762x51': '7.62x51 мм',
      '762x54R': '7.62x54 мм R', '1143x23ACP': '.45 ACP', '127x33': '12.7x33 мм',
      '127x99': '12.7x99 мм', '57x28': '5.7x28 мм', '68x51': '6.8x51 мм',
      '762x35': '7.62x35 мм', '784x49': '7.84x49 мм', '86x70': '8.6x70 мм Lapua',
      '93x64': '9.3x64 мм', '9x18PM': '9x18 мм ПМ', '9x19PARA': '9x19 мм Para', '9x33R': '9x33 мм R'
    };
    return map[raw] || raw;
  };

  const getPenColor = (pen: number) => {
    if (pen >= 50) return 'text-orange-500';
    if (pen >= 40) return 'text-orange-400';
    if (pen >= 30) return 'text-zinc-100';
    if (pen >= 20) return 'text-zinc-400';
    return 'text-zinc-600';
  };

  const calibers = useMemo(() => {
    if (!ammo.length) return ['ALL'];
    const list = ammo.map(item => formatCaliber(item.properties?.caliber || ''));
    return ['ALL', ...Array.from(new Set(list))].sort();
  }, [ammo]);

  const filteredAndSortedAmmo = useMemo(() => {
    let filtered = ammo.filter(item => {
      const s = search.toLowerCase();
      const nameMatch = item.name?.toLowerCase().includes(s) || item.shortName?.toLowerCase().includes(s);
      const calMatch = selectedCaliber === 'ALL' || formatCaliber(item.properties?.caliber || '').includes(selectedCaliber);
      
      const traderOffer = item.buyFor?.find((o: any) => o.vendor?.name !== 'Flea Market');
      const itemLL = traderOffer?.requirements?.find((r: any) => r.type === 'loyaltyLevel')?.value || null;
      
      const traderMatch = onlyTraders ? !!traderOffer : true;
      const llMatch = selectedLL ? itemLL === selectedLL : true;
      
      return nameMatch && calMatch && traderMatch && llMatch;
    });

    return filtered.sort((a, b) => {
      let aVal = sortConfig.key === 'name' ? a[sortConfig.key] : a.properties?.[sortConfig.key];
      let bVal = sortConfig.key === 'name' ? b[sortConfig.key] : b.properties?.[sortConfig.key];
      
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [ammo, search, selectedCaliber, sortConfig, onlyTraders, selectedLL]);

  const toggleSort = (key: 'name' | 'damage' | 'penetrationPower') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col font-sans text-white">
      
      <div className="flex-grow max-w-7xl mx-auto px-6 py-12 w-full">
        <h1 className="text-5xl font-medium uppercase tracking-tighter mb-2">Баллистика EFT</h1>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-10">Сравнительные характеристики урона и бронепробития боеприпасов</p>
        
        {/* Инпут в стиле Shadcn UI */}
        <input 
          type="text" placeholder="ПОИСК..." value={search}
          onFocus={() => selectedCaliber !== 'ALL' && setSelectedCaliber('ALL')}
          className="flex h-12 w-full md:w-96 rounded-md border border-input bg-zinc-900/50 px-4 py-3 text-sm tracking-widest uppercase font-bold ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus:border-orange-500 mb-8 transition-all"
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Кнопки калибров в стиле Shadcn UI */}
        <div className="flex flex-wrap gap-2 mb-6 pb-2">
          {calibers.map(cal => (
            <button 
              key={cal} 
              onClick={() => { setSelectedCaliber(cal); setSearch(''); }}
              className={`inline-flex items-center justify-center rounded-md text-[10px] font-black uppercase tracking-wider h-9 px-4 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                selectedCaliber === cal 
                  ? 'bg-orange-500 border-orange-500 text-black hover:bg-orange-600' 
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white'
              }`}
            >
              {cal === 'ALL' ? 'Все калибры' : cal}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-8 mb-10">
          {/* Чекбокс торговцев в стиле Shadcn UI */}
          <div 
            className="flex items-center gap-3 select-none cursor-pointer group" 
            onClick={() => {
              const next = !onlyTraders;
              setOnlyTraders(next);
              if (!next) setSelectedLL(null);
            }}
          >
            <div className={`h-5 w-5 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center transition-all ${
              onlyTraders ? 'bg-orange-500 border-orange-500' : 'bg-transparent border-zinc-700'
            }`}>
              {onlyTraders && <span className="text-black font-black text-xs">✓</span>}
            </div>
            <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${onlyTraders ? 'text-orange-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
              Только торговцы
            </span>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((level) => (
              <button 
                key={level} 
                onClick={() => { setSelectedLL(selectedLL === level ? null : level); setOnlyTraders(true); }}
                className={`w-12 h-8 flex items-center justify-center text-[11px] font-black rounded-md border transition-all ${
                  selectedLL === level 
                    ? 'bg-orange-500 border-orange-500 text-black' 
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                {level === 4 ? '👑 Корона' : `УР ${level}`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-black">
          <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
            <thead>
              <tr className="bg-zinc-900 text-[10px] uppercase tracking-widest text-orange-500 font-black select-none">
                <th className="p-6 border-b border-zinc-800 w-36">Вид</th>
                <th className="p-6 border-b border-zinc-800 w-80 cursor-pointer hover:bg-zinc-800 transition-colors" onClick={() => toggleSort('name')}>
                  Боеприпас / Калибр {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="p-6 border-b border-zinc-800 w-64">Доступность</th>
                <th className="p-6 border-b border-zinc-800 text-center w-32 cursor-pointer hover:bg-zinc-800 transition-colors" onClick={() => toggleSort('damage')}>
                  Урон {sortConfig.key === 'damage' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="p-6 border-b border-zinc-800 text-center w-40 cursor-pointer hover:bg-zinc-800 transition-colors" onClick={() => toggleSort('penetrationPower')}>
                  Бронепробитие {sortConfig.key === 'penetrationPower' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-orange-500 font-black animate-pulse tracking-widest uppercase italic">
                    Синхронизация данных...
                  </td>
                </tr>
              ) : filteredAndSortedAmmo.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-zinc-600 uppercase text-xs font-black tracking-widest">
                    Данные отсутствуют
                  </td>
                </tr>
              ) : (
                filteredAndSortedAmmo.map((item, index) => {
                  const traderOffer = item.buyFor?.find((o: any) => o.vendor?.name !== 'Flea Market');
                  const level = traderOffer?.requirements?.find((r:any) => r.type === 'loyaltyLevel')?.value || 1;
                  return (
                    <tr key={item.id || index} className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-all group">
                      <td className="p-6">
                        <Link href={`/tarkov/ammo/${item.id}`}>
                          <div className="bg-zinc-900 p-2 border border-zinc-800 w-24 h-24 flex items-center justify-center group-hover:border-orange-500 transition-colors cursor-pointer rounded-lg">
                            <img src={item.image512pxLink} className="w-20 h-20 object-contain" alt={item.name} draggable="false" />
                          </div>
                        </Link>
                      </td>
                      <td className="p-6">
                        <div className="text-white font-black uppercase text-xl truncate" title={item.name}>{item.name}</div>
                        <div className="text-zinc-600 text-xs font-bold mt-2 uppercase">{formatCaliber(item.properties?.caliber || '')}</div>
                      </td>
                      <td className="p-6">
                        {traderOffer ? (
                          <div className="flex items-center gap-4">
                            <div className="bg-orange-500 text-black px-3 py-1.5 text-xs font-black rounded-md">{level === 4 ? '👑' : `УР${level}`}</div>
                            <div className="flex flex-col">
                              <span className="text-white font-black text-2xl leading-none">{traderOffer.price.toLocaleString()} {traderOffer.currency}</span>
                              <span className="text-zinc-500 text-[10px] font-bold mt-1 uppercase">{traderOffer.vendor?.name}</span>
                            </div>
                          </div>
                        ) : <span className="text-zinc-700 uppercase text-xs font-black opacity-50 italic">Найдено в рейде</span>}
                      </td>
                      <td className="p-6 text-white font-black text-center text-5xl">{item.properties?.damage}</td>
                      <td className={`p-6 font-black text-center text-5xl ${getPenColor(item.properties?.penetrationPower)}`}>
                        {item.properties?.penetrationPower}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}