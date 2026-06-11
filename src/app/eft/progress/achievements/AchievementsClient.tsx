"use client";

import { useState, useMemo } from 'react';
import { Search, Trophy, EyeOff, X, LayoutGrid, List } from 'lucide-react';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  hidden: boolean;
  playersCompletedPercent: number;
}

interface AchievementsClientProps {
  initialData: Achievement[];
}

function getRarity(percent: number) {
  if (percent > 25) return { label: 'ОБЫЧНОЕ', color: 'text-text-muted', border: 'border-lines-hover' };
  if (percent > 10) return { label: 'РЕДКОЕ', color: 'text-blue-400', border: 'border-blue-500/30' };
  if (percent > 1) return { label: 'ЭПИЧЕСКОЕ', color: 'text-purple-400', border: 'border-purple-500/30' };
  return { label: 'ЛЕГЕНДАРНОЕ', color: 'text-yellow-500', border: 'border-yellow-500/50' };
}

export function AchievementsClient({ initialData }: AchievementsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "visible" | "hidden">("all");
  const [sortOrder, setSortOrder] = useState<"rare" | "common">("rare");
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const processedData = useMemo(() => {
    let data = [...initialData];

    // Фильтрация по поиску
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }

    // Фильтрация по видимости
    if (filterType === "visible") data = data.filter(a => !a.hidden);
    if (filterType === "hidden") data = data.filter(a => a.hidden);

    // Сортировка по редкости
    data.sort((a, b) => {
      const pA = a.playersCompletedPercent ?? 0;
      const pB = b.playersCompletedPercent ?? 0;
      return sortOrder === "rare" ? pA - pB : pB - pA;
    });

    return data;
  }, [initialData, searchQuery, filterType, sortOrder]);

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* ТАКТИЧЕСКАЯ ПАНЕЛЬ УПРАВЛЕНИЯ */}
      <div className="bg-card-menu border border-lines-hover p-4 rounded flex flex-col sm:flex-row gap-4 items-center justify-between shadow-lg">
        <div className="relative flex items-center bg-[#0D0D0F] border border-lines-hover rounded h-10 px-3 w-full sm:flex-1 focus-within:border-[var(--primary)] transition-colors">
          <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
          <input 
            type="text"
            placeholder="ПОИСК ДОСТИЖЕНИЙ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[12px] font-blender-medium uppercase tracking-wider text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-text-muted hover:text-text-primary shrink-0 ml-2">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as any)}
            className="flex-1 sm:flex-none bg-[#0D0D0F] text-text-secondary text-[12px] font-blender-medium uppercase tracking-wider border border-lines-hover rounded h-10 px-3 focus:outline-none focus:border-[var(--primary)] cursor-pointer"
          >
            <option value="all">Все типы</option>
            <option value="visible">Открытые</option>
            <option value="hidden">Скрытые</option>
          </select>
          <select 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="flex-1 sm:flex-none bg-[#0D0D0F] text-text-secondary text-[12px] font-blender-medium uppercase tracking-wider border border-lines-hover rounded h-10 px-3 focus:outline-none focus:border-[var(--primary)] cursor-pointer"
          >
            <option value="rare">Сначала редкие</option>
            <option value="common">Сначала частые</option>
          </select>

          <div className="hidden sm:block w-[1px] h-6 bg-lines-hover mx-2" />

          <div className="flex items-center gap-1 bg-[#0D0D0F] border border-lines-hover rounded p-1">
            <button
                onClick={() => setViewMode('grid')}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:bg-lines-hover'
                }`}
                title="Плитка"
            >
                <LayoutGrid className="w-4 h-4" />
            </button>
            <button
                onClick={() => setViewMode('table')}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    viewMode === 'table' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:bg-lines-hover'
                }`}
                title="Список"
            >
                <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* СЕТКА ДОСТИЖЕНИЙ */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {processedData.map((ach) => {
            const rarity = getRarity(ach.playersCompletedPercent ?? 0);
            return (
              <div key={ach.id} className={`bg-[#0D0D0F] border ${rarity.border} rounded p-5 flex flex-col relative overflow-hidden group hover:border-[var(--primary)] hover:shadow-[0_0_20px_rgba(230,142,37,0.1)] transition-all duration-300`}>
                <div className="flex items-start justify-between mb-3 gap-4">
                  <h3 className="font-blender-medium text-[18px] leading-none uppercase text-text-primary group-hover:text-[var(--primary)] transition-colors">{ach.name}</h3>
                  {ach.hidden ? <span title="Скрытое достижение" className="shrink-0 flex items-center justify-center"><EyeOff className="w-4 h-4 text-text-muted" /></span> : <Trophy className={`w-4 h-4 shrink-0 ${rarity.color}`} />}
                </div>
                <p className="text-sm text-text-secondary mb-6 flex-grow">{ach.description}</p>
                <div className="flex items-center justify-between pt-3 border-t border-lines-hover mt-auto">
                  <span className={`text-[10px] font-black tracking-widest uppercase ${rarity.color}`}>{rarity.label}</span>
                  <span className="text-xs font-mono text-text-muted">{(ach.playersCompletedPercent ?? 0).toFixed(1)}% игроков</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden border border-lines-hover rounded-lg bg-card-menu/20">
          <table className="w-full text-sm">
              <thead className="bg-card-menu/50">
                  <tr>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-text-muted uppercase tracking-widest w-12"></th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-text-muted uppercase tracking-widest">Название</th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-black text-text-muted uppercase tracking-widest hidden md:table-cell">Описание</th>
                      <th scope="col" className="px-4 py-3 text-right text-[10px] font-black text-text-muted uppercase tracking-widest w-32">Редкость</th>
                  </tr>
              </thead>
              <tbody>
                  {processedData.map((ach) => {
                      const rarity = getRarity(ach.playersCompletedPercent ?? 0);
                      return (
                          <tr key={ach.id} className="border-b border-lines-hover last:border-b-0 hover:bg-card-menu/30 transition-colors">
                              <td className="px-4 py-3 text-center">
                                  {ach.hidden ? (
                                      <span title="Скрытое достижение"><EyeOff className="w-4 h-4 text-text-muted mx-auto" /></span>
                                  ) : (
                                      <Trophy className={`w-4 h-4 mx-auto ${rarity.color}`} />
                                  )}
                              </td>
                              <td className="px-4 py-3 font-blender-medium text-text-primary">{ach.name}</td>
                              <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{ach.description}</td>
                              <td className="px-4 py-3 text-right">
                                  <div className="flex flex-col items-end">
                                      <span className={`font-mono text-xs ${rarity.color}`}>{(ach.playersCompletedPercent ?? 0).toFixed(1)}%</span>
                                      <span className={`text-[10px] font-black tracking-widest uppercase ${rarity.color}`}>{rarity.label}</span>
                                  </div>
                              </td>
                          </tr>
                      );
                  })}
              </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
