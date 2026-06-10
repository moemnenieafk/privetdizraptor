"use client";

import { PageHeader } from '@/components/ui/PageHeader';
import Image from "next/image";
import { useRef, useState, MouseEvent, useEffect, useMemo } from "react";
import { Maximize, Minimize, Search, X } from "lucide-react";
import { praporQuests } from "./prapor";
import { therapistQuests } from "./therapist";
import { skierQuests } from "./skier";
export default function QuestsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 150 });
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.6);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyKappa, setOnlyKappa] = useState(false);
  const [completedQuests, setCompletedQuests] = useState<Record<string, boolean>>({});

  const tradersConfig = [
    { id: 'prapor', name: 'Прапор', x: 0, quests: praporQuests },
    { id: 'therapist', name: 'Терапевт', x: 300, quests: therapistQuests },
    { id: 'skier', name: 'Лыжник', x: 600, quests: skierQuests },
  ];

  const stats = useMemo(() => {
    const allQuests = tradersConfig.flatMap(t => t.quests);
    const total = allQuests.length;
    const completed = allQuests.filter(q => completedQuests[q.id]).length;
    return {
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [completedQuests]);

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    setStartMouse({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - startMouse.x,
      y: e.clientY - startMouse.y
    });
  };

  const toggleQuest = (id: string) => {
    setCompletedQuests(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToQuest = (query: string) => {
    if (!query) return;
    let foundQuest = null;
    let foundTrader = null;

    for (const trader of tradersConfig) {
      const quest = trader.quests.find(q => q.title.toLowerCase().includes(query.toLowerCase()));
      if (quest) {
        foundQuest = quest;
        foundTrader = trader;
        break;
      }
    }

    if (foundQuest && foundTrader) {
      const questGlobalX = foundTrader.x + foundQuest.x;
      const questGlobalY = 120 + foundQuest.y;

      const windowWidth = window.innerWidth;
      const containerHeight = isFullscreen ? window.innerHeight : (containerRef.current?.clientHeight || window.innerHeight);

      const targetScale = 0.85; 
      setScale(targetScale);

      setPosition({
        x: windowWidth / 2 - (questGlobalX + 500) * targetScale,
        y: containerHeight / 2 - (questGlobalY + 500) * targetScale
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomSpeed = 0.001;
        const delta = -e.deltaY * zoomSpeed;
        setScale(prev => Math.min(Math.max(prev + delta, 0.2), 1.5));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const renderConnector = (x1: number, y1: number, x2: number, y2: number, isCurrentDone: boolean, id: string, isDimmed: boolean) => {
    const x1_val = Math.round(x1);
    const y1_val = Math.round(y1);
    const x2_val = Math.round(x2);
    const y2_val = Math.round(y2);

    let d = "";
    if (Math.abs(x1_val - x2_val) < 50) {
      d = `M ${x1_val} ${y1_val} L ${x1_val} ${y2_val}`;
    } else {
      const midY = Math.round(y1_val + 20);
      d = `M ${x1_val} ${y1_val} L ${x1_val} ${midY} L ${x2_val} ${midY} L ${x2_val} ${y2_val}`;
    }
    
    return (
      <path
        key={`line-${id}`}
        d={d}
        fill="none"
        stroke={isCurrentDone ? 'var(--color-lines-hover)' : 'var(--color-primary)'}
        strokeWidth="2"
        className={!isCurrentDone ? 'line-ants' : ''}
        style={{ 
          transition: 'stroke 0.4s ease, opacity 0.3s ease',
          opacity: isDimmed ? 0.1 : (isCurrentDone ? 0.5 : 1) 
        }}
      />
    );
  };

  /* x1 = Math.round(x1);
    y1 = Math.round(y1);
    x2 = Math.round(x2);
    y2 = Math.round(y2);

    let d = "";
    if (Math.abs(x1 - x2) < 50) {
      d = `M ${x1} ${y1} L ${x1} ${y2}`;
    } else {
      const midY = Math.round(y1 + 20); // Сглаживание угла
      d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    }
    
    return (
      <path
        key={`line-${id}`}
        d={d}
        fill="none"
        stroke={isCurrentDone ? 'var(--color-lines-hover)' : 'var(--color-primary)'}
        strokeWidth="2"
        className={!isCurrentDone ? 'line-ants' : ''}
        style={{ 
          transition: 'stroke 0.4s ease, opacity 0.3s ease',
          opacity: isDimmed ? 0.1 : (isCurrentDone ? 0.5 : 1) 
        }}
      />
    ); 
  }; */

  return (
    <main className={`flex w-full flex-col items-center justify-start ${isFullscreen ? '' : 'pt-[28px] pb-[56px]'} animate-[fade-in_0.5s_ease-out_both] min-h-[70vh]`}>
      
      {!isFullscreen && (
        <div className="w-full max-w-[1100px] px-4 xl:px-0 mx-auto">
          <PageHeader pageId="eft-questmap" />
        </div>
      )}

      <div className={`w-full bg-base flex flex-col overflow-hidden select-none relative ${isFullscreen ? 'fixed inset-0 z-[100] h-screen' : 'h-[700px] max-w-[1100px] mx-auto border border-lines-hover rounded-xl shadow-lg mt-2'}`}>
        
        <style>{`
          @keyframes ants { to { stroke-dashoffset: -12; } }
          .line-ants { stroke-dasharray: 6, 6; animation: ants 0.8s linear infinite; }
          ${isFullscreen ? `
            html, body { overflow: hidden !important; height: 100% !important; }
            ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
            * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
          ` : ''}
        `}</style>

        {/* ПАНЕЛЬ УПРАВЛЕНИЯ ФУНКЦИЯМИ */}
        <div className="flex-shrink-0 bg-card-menu border-b border-lines-hover p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between z-10 gap-4 sm:gap-0 shadow-md">
          
          {/* Левая часть: Поиск и Статистика */}
          <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
             {/* Статистика */}
             <div className="flex flex-col hidden sm:flex">
               <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Прогресс квестов</span>
               <span className="text-lg font-blender-medium text-text-primary leading-none mt-1">
                 {stats.completed} <span className="text-text-muted">/ {stats.total}</span>
                 <span className="text-primary ml-2">({stats.percent}%)</span>
               </span>
             </div>

             {/* Поиск */}
             <div className="relative flex items-center bg-[#0D0D0F] border border-lines-hover rounded h-10 px-3 w-full sm:w-[300px] focus-within:border-primary/50 transition-colors">
               <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
               <input 
                 type="text"
                 placeholder="ПОИСК КВЕСТА..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     scrollToQuest(searchQuery);
                   }
                 }}
                 className="w-full bg-transparent text-[12px] font-blender-medium tracking-wider text-text-primary uppercase placeholder:text-text-muted focus:outline-none"
               />
               {searchQuery && (
                 <button onClick={() => setSearchQuery("")} className="text-text-muted hover:text-text-primary shrink-0 ml-2">
                   <X className="w-4 h-4" />
                 </button>
               )}
             </div>
          </div>

          {/* Правая часть: Фильтры и Фулскрин */}
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
             <button 
               onClick={() => setOnlyKappa(!onlyKappa)}
               className={`flex items-center justify-center gap-2 h-10 px-4 rounded border transition-all flex-1 sm:flex-none ${
                 onlyKappa 
                   ? 'border-primary/50 bg-primary/10 text-primary' 
                   : 'border-lines-hover bg-[#0D0D0F] text-text-secondary hover:border-primary/30'
               }`}
             >
               <div className={`w-5 h-5 icon-bg icon-eft-profile-kappa ${onlyKappa ? 'opacity-100' : 'opacity-50 grayscale'}`} />
               <span className="text-[12px] font-blender-medium uppercase tracking-widest mt-0.5 whitespace-nowrap">Только Каппа</span>
             </button>

             <div className="hidden sm:block w-[1px] h-6 bg-lines-hover mx-2" />

             <button 
               onClick={() => setIsFullscreen(!isFullscreen)}
               className="flex items-center justify-center w-10 h-10 rounded border border-lines-hover bg-[#0D0D0F] text-text-muted hover:text-primary hover:border-primary/50 transition-colors shrink-0"
               title={isFullscreen ? "Выйти из полноэкранного режима (Esc)" : "На весь экран"}
             >
               {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
             </button>
          </div>
        </div>

        {/* ХОЛСТ С КАРТОЙ КВЕСТОВ */}
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          className={`flex-1 relative overflow-hidden bg-[url('/images/grid-pattern.svg')] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ 
            backgroundImage: `radial-gradient(circle, var(--color-lines-hover) 1px, transparent 1px)`,
            backgroundSize: `${53 * scale}px ${53 * scale}px`,
            backgroundPosition: `${position.x}px ${position.y}px`,
          }}
        >
          <div 
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
            className="absolute top-0 left-0 p-[500px] min-w-max transition-transform duration-300 ease-out"
          >
            {tradersConfig.map((trader) => (
              <div 
                key={trader.id} 
                style={{
                  position: 'absolute',
                  left: `${trader.x}px`,
                  top: '0px'
                }}
                className="flex flex-col items-center w-[220px] relative"
              >
                {/* Аватар торговца */}
                <div className="relative w-32 h-32 mb-[120px] select-none pointer-events-none z-20">
                  <div className="absolute inset-0 border-2 border-lines-hover bg-[#0D0D0F] rounded-lg overflow-hidden flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                    <Image 
                      src={`/images/traders/${trader.id}.webp`} 
                      alt={trader.name} 
                      fill 
                      className="object-cover" 
                      sizes="128px"
                      draggable="false"
                    />
                  </div>
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-base/80 backdrop-blur px-3 py-1 border border-lines-hover rounded text-text-primary font-blender-medium uppercase text-sm tracking-widest whitespace-nowrap shadow-md">
                    {trader.name}
                  </div>

                  <svg className="absolute pointer-events-none overflow-visible left-1/2 bottom-0 w-0 h-0 z-0">
                    {trader.quests.map((quest) => {
                      if (!quest.parentId) {
                        const isCurrentDone = completedQuests[quest.id];
                        const matchesSearch = searchQuery ? quest.title.toLowerCase().includes(searchQuery.toLowerCase()) : true;
                        const matchesKappa = onlyKappa ? quest.kappa : true;
                        const isDimmed = !matchesSearch || !matchesKappa;

                        return renderConnector(
                          0, 0, 
                          quest.x, 120 + quest.y, 
                          isCurrentDone, 
                          `start-${trader.id}-${quest.id}`,
                          isDimmed
                        );
                      }
                      return null;
                    })}
                  </svg>
                </div>

                <div className="absolute top-[250px] left-1/2 -translate-x-1/2 w-0 h-0 overflow-visible">
                  <svg className="absolute pointer-events-none overflow-visible" style={{ zIndex: 0, left: 0, top: 0 }}>
                    {trader.quests.map((quest) => {
                      const questCenterX = quest.x; 
                      const isCurrentDone = completedQuests[quest.id];
                      
                      if (quest.parentId) {
                        const parent = trader.quests.find(q => q.id === quest.parentId);
                        if (parent) {
                          const matchesSearch = searchQuery ? quest.title.toLowerCase().includes(searchQuery.toLowerCase()) : true;
                          const matchesKappa = onlyKappa ? quest.kappa : true;
                          const isDimmed = !matchesSearch || !matchesKappa;

                          return renderConnector(
                            parent.x, parent.y + 80, 
                            questCenterX, quest.y,         
                            isCurrentDone,
                            quest.id,
                            isDimmed
                          );
                        }
                      }
                      return null;
                    })}
                  </svg>

                  {trader.quests.map((quest) => {
                    const isCompleted = completedQuests[quest.id];
                    
                    const matchesSearch = searchQuery ? quest.title.toLowerCase().includes(searchQuery.toLowerCase()) : true;
                    const matchesKappa = onlyKappa ? quest.kappa : true;

                    let cardOpacity = "opacity-100";
                    
                    if (!matchesSearch || !matchesKappa) {
                      cardOpacity = "opacity-20 grayscale";
                    } else if (isCompleted) {
                      cardOpacity = "opacity-60";
                    }

                    return (
                      <div 
                        key={quest.id}
                        style={{ 
                          transform: `translate(calc(${quest.x}px - 50%), ${quest.y}px)`, 
                          zIndex: isCompleted ? 5 : 10 
                        }}
                        className={`absolute w-[200px] p-3 bg-card-menu border rounded shadow-lg transition-all duration-300 ${cardOpacity} ${
                          !isCompleted && matchesSearch && matchesKappa ? 'hover:border-primary/50 hover:shadow-[0_0_15px_rgba(230,142,37,0.2)] border-lines-hover' : 'border-lines-hover/50'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-3 h-[26px]">
                          <span className={`text-[12px] font-blender-medium leading-none uppercase ${isCompleted ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                            {quest.title}
                          </span>
                          {quest.kappa && (
                            <div className="w-[18px] h-[18px] shrink-0 icon-bg icon-eft-profile-kappa" title="Необходимо для получения Каппы" />
                          )}
                        </div>

                        <button 
                          onClick={() => toggleQuest(quest.id)}
                          className={`w-full py-1.5 text-[10px] font-blender-medium uppercase tracking-widest transition-all rounded ${
                            isCompleted 
                              ? 'bg-lines-hover text-text-muted hover:bg-lines-hover/80 hover:text-text-primary' 
                              : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/50'
                          }`}
                        >
                          {isCompleted ? 'ВЫПОЛНЕНО' : 'ОТМЕТИТЬ'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
