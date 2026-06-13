'use client';

import { useState, useEffect, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { ProfileResetModal } from './ProfileResetModal';

export type EditionType = 'Standard' | 'LB' | 'PFE' | 'EOD' | 'TUE';

export const EDITIONS: Record<EditionType, { id: EditionType, name: string, sub: string, color: string, border: string, bgAlpha: string, icon: string, placeholder: string }> = {
  TUE: { id: 'TUE', name: 'The Unheard', sub: 'ultimate edition', color: 'text-[#5FCAFF]', border: 'border-[#5FCAFF]', bgAlpha: 'bg-[#5FCAFF]/10', icon: 'icon-eft-profile-tue', placeholder: 'placeholder:text-[#5FCAFF]/50' },
  EOD: { id: 'EOD', name: 'Edge of Darkness', sub: 'limited edition', color: 'text-[#E68E25]', border: 'border-[#E68E25]', bgAlpha: 'bg-[#E68E25]/10', icon: 'icon-eft-profile-eod', placeholder: 'placeholder:text-[#E68E25]/50' },
  PFE: { id: 'PFE', name: 'Prepare for Escape', sub: 'extended edition', color: 'text-[#8A795D]', border: 'border-[#8A795D]', bgAlpha: 'bg-[#8A795D]/10', icon: 'icon-eft-profile-pfe', placeholder: 'placeholder:text-[#8A795D]/50' },
  LB: { id: 'LB', name: 'Left Behind', sub: 'early access edition', color: 'text-[#6B7280]', border: 'border-[#6B7280]', bgAlpha: 'bg-[#6B7280]/10', icon: 'icon-eft-profile-lb', placeholder: 'placeholder:text-[#6B7280]/50' },
  Standard: { id: 'Standard', name: 'Standard', sub: 'basic edition', color: 'text-[#374151]', border: 'border-[#374151]', bgAlpha: 'bg-[#374151]/10', icon: 'icon-eft-profile-s', placeholder: 'placeholder:text-[#374151]/50' }
};

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  edition: EditionType;
  setEdition: (val: EditionType) => void;
  faction: 'USEC' | 'BEAR';
  setFaction: (val: 'USEC' | 'BEAR') => void;
  mode: 'PVP' | 'PVE';
  setMode: (val: 'PVP' | 'PVE') => void;
  nickname: string;
  setNickname: (val: string) => void;
  level: string;
  setLevel: (val: string) => void;
  prestige: string;
  setPrestige: (val: string) => void;
  traderLevels: Record<string, number>;
  setTraderLevels: (val: Record<string, number>) => void;
}

// Конфигурация списка торговцев в правильном порядке
const TRADERS = [
  { id: 'prapor', name: 'Прапор', icon: 'icon-eft-quests-prapor' },
  { id: 'therapist', name: 'Терапевт', icon: 'icon-eft-quests-therapist' },
  { id: 'fence', name: 'Скупщик', icon: 'icon-eft-quests-fence' },
  { id: 'skier', name: 'Лыжник', icon: 'icon-eft-quests-skier' },
  { id: 'peacekeeper', name: 'Миротворец', icon: 'icon-eft-quests-peacekeeper' },
  { id: 'mechanic', name: 'Механик', icon: 'icon-eft-quests-mechanic' },
  { id: 'ragman', name: 'Барахольщик', icon: 'icon-eft-quests-ragman' },
  { id: 'jaeger', name: 'Егерь', icon: 'icon-eft-quests-jaeger' },
  { id: 'ref', name: 'Реф', icon: 'icon-eft-quests-ref' },
];

// Хелпер для иконки уровня (из PlayerTelemetry)
const getLevelGroup = (level: number) => {
  if (level < 5) return 1;
  return Math.min(16, Math.floor(level / 5) + 1);
};

export function ProfileSettingsModal({ isOpen, onClose, edition, setEdition, faction, setFaction, mode, setMode, nickname, setNickname, level, setLevel, prestige, setPrestige, traderLevels, setTraderLevels }: ProfileSettingsModalProps) {

  // Состояния для анимации модального окна
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике вне модалки, если не открыто вложенное окно сброса
  useClickOutside(modalRef, onClose, isVisible && !isResetModalOpen);

  // Эффект задержки для плавного появления/исчезновения
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Закрытие по клавише Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Обработчики изменения уровня (1-99)
  const handleLevelChange = (delta: number) => {
    const current = level === '' ? 1 : Number(level);
    const next = Math.max(1, Math.min(99, current + delta));
    setLevel(next.toString());
  };
  const handleLevelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); handleLevelChange(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); handleLevelChange(-1); }
  };

  // Обработчики изменения престижа (0-6)
  const handlePrestigeChange = (delta: number) => {
    const current = prestige === '' ? 0 : Number(prestige);
    const next = Math.max(0, Math.min(6, current + delta));
    setPrestige(next.toString());
  };
  const handlePrestigeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); handlePrestigeChange(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); handlePrestigeChange(-1); }
  };

  // Обработчик кнопки Автоопределения (Имитация запроса к API)
  const handleAutoDetect = () => {
    if (isAutoDetecting) return;
    setIsAutoDetecting(true);
    setTimeout(() => {
      setIsAutoDetecting(false);
      // Имитируем получение данных успешного прокачанного профиля
      setNickname('FULLKAMEN_API');
      setLevel('65');
      setPrestige('4');
      setEdition('TUE');
      setFaction('BEAR');
      setMode('PVP');
      setTraderLevels({ prapor: 4, therapist: 4, fence: 4, skier: 4, peacekeeper: 4, mechanic: 4, ragman: 4, jaeger: 4, ref: 4 });
    }, 2000);
  };

  if (!isRendered) return null;

  const activeEd = EDITIONS[edition];

  return (
    // Оверлей модального окна
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      
      {/* Контейнер модалки (348px) */}
      <div 
        ref={modalRef}
        className={`flex w-[348px] flex-col items-start justify-start shadow-2xl transition-all duration-300 ease-out ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
      >
        
        {/* ШАПКА */}
        <div className="relative flex h-7 w-full items-center justify-start gap-1 rounded-t bg-[#222225]">
          <div className="flex h-7 w-7 items-center justify-center p-1.5">
            <div className="h-full w-full icon-mask icon-eft-profile-settings text-[#9CA3AF]" />
          </div>
          <div className="text-sm font-blender-medium leading-4 text-zinc-100">Настройки профиля ЧВК</div>
          
          {/* Кнопка закрытия */}
          <button onClick={onClose} className="absolute right-0 top-0 h-7 w-7 flex items-center justify-center transition-opacity hover:opacity-80">
            <div className="flex h-3 w-4 items-center justify-center rounded-[1px] bg-[#7E2C25]">
              <div className="h-2 w-2 icon-mask icon-eft-profile-btn-close text-zinc-100" />
            </div>
          </button>
        </div>

        {/* ТЕЛО МОДАЛКИ */}
        <div className="flex w-full flex-col items-center justify-center gap-7 overflow-hidden rounded-b border border-[#222225] bg-[#161618] p-7">
          
          {/* ИМЯ ЧВК */}
          <div className="flex w-full flex-col items-start justify-start gap-2">
            <div className="text-base font-blender-medium uppercase leading-4 text-text-secondary">Имя ЧВК</div>
            <div className={`flex h-10 w-full items-center justify-start gap-2 rounded border bg-[#0D0D0F] px-2 py-3.5 transition-all duration-300 ${nickname.length >= 15 ? 'border-[#C24339] shadow-[0_0_12px_rgba(194,67,57,0.3)]' : 'border-[#222225]'}`}>
              <div className="flex w-6 items-center justify-center">
                <div className={`h-4 w-4 icon-mask ${activeEd.icon} ${activeEd.color}`} />
              </div>
              <input 
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              maxLength={15}
                className={`flex-1 w-full bg-transparent text-xl font-blender-medium leading-5 ${activeEd.color} outline-none ${activeEd.placeholder}`}
                spellCheck={false}
              />
            </div>
          </div>

          {/* УРОВЕНЬ И ПРЕСТИЖ */}
          <div className="flex w-full items-start justify-start gap-7">
            <div className="flex flex-1 flex-col items-start justify-start gap-2">
              <div className="text-base font-blender-medium uppercase leading-4 text-text-secondary">Уровень ЧВК</div>
              <div className="flex h-10 w-full items-center justify-between rounded border border-[#222225] bg-[#0D0D0F] px-2 py-1">
                <img className="h-7 w-7 object-contain" src={`/icons/eft/lvl-icons/player-level-group-${getLevelGroup(Number(level) || 1)}.webp`} alt={`Level ${level}`} />
                <input 
                  type="text"
                  value={level}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 2);
                    if (val === '0' || val === '00') val = '';
                    else if (val.length === 2 && val.startsWith('0')) val = val[1];
                    setLevel(val);
                  }}
                  onKeyDown={handleLevelKeyDown}
                  className="flex-1 w-full bg-transparent px-1 text-center text-2xl font-blender-medium leading-6 text-zinc-100 outline-none placeholder:text-zinc-100/30"
                  placeholder="1"
                />
                <div className="flex flex-col items-center justify-center gap-[2px]">
                  <button onClick={() => handleLevelChange(1)} className="flex h-3 w-4 items-center justify-center text-[#52525B] hover:text-[var(--primary)] transition-colors focus:outline-none">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleLevelChange(-1)} className="flex h-3 w-4 items-center justify-center text-[#52525B] hover:text-[var(--primary)] transition-colors focus:outline-none">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col items-start justify-start gap-2">
              <div className="text-base font-blender-medium uppercase leading-4 text-text-secondary">Престиж</div>
              <div className="flex h-10 w-full items-center justify-between rounded border border-[#222225] bg-[#0D0D0F] px-2 py-1">
                {!prestige || prestige === '0' ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                    <div className="h-4 w-4 icon-mask icon-eft-prog-prestige text-[#222225]" />
                  </div>
                ) : (
                  <img className="h-7 w-7 shrink-0 object-contain" src={`/icons/eft/prestige/prestige-${prestige}.webp`} alt={`Prestige ${prestige}`} />
                )}
                <input 
                  type="text"
                  value={prestige === '0' ? '' : prestige}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 1);
                    if (Number(val) > 6) val = '6';
                    setPrestige(val);
                  }}
                  onKeyDown={handlePrestigeKeyDown}
                  className="flex-1 w-full bg-transparent px-1 text-center text-2xl font-blender-medium leading-6 text-zinc-100 outline-none placeholder:text-[9px] placeholder:tracking-tight placeholder:text-zinc-100/40"
                  placeholder="НЕТ ПРЕСТИЖА"
                />
                <div className="flex flex-col items-center justify-center gap-[2px]">
                  <button onClick={() => handlePrestigeChange(1)} className="flex h-3 w-4 items-center justify-center text-[#52525B] hover:text-[var(--primary)] transition-colors focus:outline-none">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => handlePrestigeChange(-1)} className="flex h-3 w-4 items-center justify-center text-[#52525B] hover:text-[var(--primary)] transition-colors focus:outline-none">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ИЗДАНИЕ */}
          <div className="flex w-full flex-col items-start justify-start gap-2">
            <div className="flex w-full items-start justify-start gap-2">
              <div className="flex-1 text-base font-blender-medium uppercase leading-4 text-text-secondary">Издание</div>
              <div className="flex flex-col items-end justify-start">
                <div className={`text-lg font-blender-medium leading-4 ${activeEd.color}`}>{activeEd.name}</div>
                <div className={`text-[10px] font-blender-medium leading-[10px] ${activeEd.color}`}>{activeEd.sub}</div>
              </div>
            </div>
            
            {/* Кнопки изданий */}
            <div className="flex w-full items-start justify-between">
              {(['Standard', 'LB', 'PFE', 'EOD', 'TUE'] as EditionType[]).map((key) => {
                const ed = EDITIONS[key];
                const isActive = edition === ed.id;
                return (
                  <button 
                    key={ed.id}
                    onClick={() => setEdition(ed.id)}
                    className={`flex h-10 w-12 items-center justify-center rounded border transition-colors ${
                      isActive ? `${ed.border} ${ed.bgAlpha}` : 'border-transparent bg-[#222225] hover:border-text-secondary'
                    }`}
                  >
                    <div className={`h-4 w-6 icon-mask ${ed.icon} ${isActive ? ed.color : 'text-text-secondary opacity-50'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ФРАКЦИИ И РЕЖИМЫ (В один ряд) */}
          <div className="flex w-full items-start justify-between gap-2">
            {/* Фракции */}
            <div className="flex flex-1 gap-1">
              <button onClick={() => setFaction('USEC')} className={`flex flex-1 flex-col items-center justify-center rounded border h-[56px] transition-all ${faction === 'USEC' ? 'border-sky-500 bg-gradient-to-t from-sky-500/20 to-transparent' : 'border-[#222225] bg-[#0D0D0F] hover:border-sky-500/50'}`}>
                <img src="/icons/eft/profile-pannel/USEC-logo-sign.svg" alt="USEC" className={`h-10 w-10 object-contain transition-opacity ${faction === 'USEC' ? 'opacity-100' : 'opacity-40'}`} />
              </button>
              <button onClick={() => setFaction('BEAR')} className={`flex flex-1 flex-col items-center justify-center rounded border h-[56px] transition-all ${faction === 'BEAR' ? 'border-orange-700 bg-gradient-to-t from-orange-700/20 to-transparent' : 'border-[#222225] bg-[#0D0D0F] hover:border-orange-700/50'}`}>
                <img src="/icons/eft/profile-pannel/BEAR-logo-sign.svg" alt="BEAR" className={`h-10 w-10 object-contain transition-opacity ${faction === 'BEAR' ? 'opacity-100' : 'opacity-40'}`} />
              </button>
            </div>
            {/* Режимы */}
            <div className="flex flex-1 gap-1">
              <button onClick={() => setMode('PVP')} className={`flex flex-1 items-center justify-center gap-1.5 rounded border h-[56px] transition-all ${mode === 'PVP' ? 'border-[#8A795D] bg-[#8A795D]/10' : 'border-[#222225] bg-[#0D0D0F] hover:border-[#8A795D]/50'}`}>
                <div className={`w-5 h-5 icon-bg icon-eft-profile-pvp transition-opacity ${mode === 'PVP' ? 'opacity-100' : 'opacity-40'}`} />
                <div className="flex flex-col items-start justify-center">
                  <div className={`text-[8px] font-blender-medium uppercase tracking-tight ${mode === 'PVP' ? 'text-[#8A795D]' : 'text-text-secondary opacity-40'}`}>Режим</div>
                  <div className={`text-sm font-blender-medium leading-none mt-[2px] ${mode === 'PVP' ? 'text-[#8A795D]' : 'text-text-secondary opacity-40'}`}>PVP</div>
                </div>
              </button>
              <button onClick={() => setMode('PVE')} className={`flex flex-1 items-center justify-center gap-1.5 rounded border h-[56px] transition-all ${mode === 'PVE' ? 'border-[#5FCAFF] bg-[#5FCAFF]/10' : 'border-[#222225] bg-[#0D0D0F] hover:border-[#5FCAFF]/50'}`}>
                <div className={`w-5 h-5 icon-bg icon-eft-profile-pve transition-opacity ${mode === 'PVE' ? 'opacity-100' : 'opacity-40'}`} />
                <div className="flex flex-col items-start justify-center">
                  <div className={`text-[8px] font-blender-medium uppercase tracking-tight ${mode === 'PVE' ? 'text-[#5FCAFF]' : 'text-text-secondary opacity-40'}`}>Режим</div>
                  <div className={`text-sm font-blender-medium leading-none mt-[2px] ${mode === 'PVE' ? 'text-[#5FCAFF]' : 'text-text-secondary opacity-40'}`}>PVE</div>
                </div>
              </button>
            </div>
          </div>

          {/* УРОВНИ ТОРГОВЦЕВ (Grid) */}
          <div className="flex w-full flex-col items-start justify-start gap-2">
            <div className="text-base font-blender-medium uppercase leading-4 text-text-secondary">Уровни торговцев</div>
            <div className="grid w-full grid-cols-9 gap-[5px]">
              
              {/* Аватарки торговцев */}
              {TRADERS.map((t) => (
                <div key={`avatar-${t.id}`} className="group/avatar relative flex h-[24px] w-full items-center justify-center rounded-[2px] cursor-help">
                  <div className={`w-6 h-6 icon-bg ${t.icon}`} />
                  {/* Всплывающая подсказка */}
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-[#0D0D0F] border border-[#222225] rounded shadow-lg text-[9px] font-blender-medium uppercase whitespace-nowrap text-text-secondary opacity-0 group-hover/avatar:opacity-100 pointer-events-none transition-opacity z-50">
                    {t.name}
                  </div>
                </div>
              ))}

              {/* Уровень КОРОНА (IV) */}
              {TRADERS.map((t) => (
                <button key={`rep-4-${t.id}`} onClick={() => setTraderLevels({ ...traderLevels, [t.id]: 4 })} className="w-full focus:outline-none group/btn">
                  <div className={`h-[20px] w-full icon-mask icon-eft-profile-rep-4 transition-colors ${traderLevels[t.id] >= 4 ? 'text-[var(--primary)]' : 'text-[#222225] group-hover/btn:text-[var(--primary)]/50'}`} />
                </button>
              ))}

              {/* Уровень III */}
              {TRADERS.map((t) => 
                t.id === 'fence' ? (
                  <div key={`rep-3-${t.id}`} className="w-full h-[20px]" />
                ) : (
                  <button key={`rep-3-${t.id}`} onClick={() => setTraderLevels({ ...traderLevels, [t.id]: 3 })} className="w-full focus:outline-none group/btn">
                    <div className={`h-[20px] w-full icon-mask icon-eft-profile-rep-3 transition-colors ${traderLevels[t.id] >= 3 ? 'text-zinc-100' : 'text-[#222225] group-hover/btn:text-[#52525B]'}`} />
                  </button>
                )
              )}

              {/* Уровень II */}
              {TRADERS.map((t) => 
                t.id === 'fence' ? (
                  <div key={`rep-2-${t.id}`} className="w-full h-[20px]" />
                ) : (
                  <button key={`rep-2-${t.id}`} onClick={() => setTraderLevels({ ...traderLevels, [t.id]: 2 })} className="w-full focus:outline-none group/btn">
                    <div className={`h-[20px] w-full icon-mask icon-eft-profile-rep-2 transition-colors ${traderLevels[t.id] >= 2 ? 'text-zinc-100' : 'text-[#222225] group-hover/btn:text-[#52525B]'}`} />
                  </button>
                )
              )}

              {/* Уровень I */}
              {TRADERS.map((t) => (
                <button key={`rep-1-${t.id}`} onClick={() => setTraderLevels({ ...traderLevels, [t.id]: 1 })} className="w-full focus:outline-none group/btn">
                  <div className={`h-[20px] w-full icon-mask icon-eft-profile-rep-1 transition-colors ${traderLevels[t.id] >= 1 ? 'text-zinc-100' : 'text-[#222225] group-hover/btn:text-[#52525B]'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* КНОПКА АВТООПРЕДЕЛЕНИЯ */}
          <button 
            onClick={handleAutoDetect}
            disabled={isAutoDetecting}
            className="group relative flex h-8 w-full cursor-pointer items-center justify-center overflow-hidden rounded border border-[#222225] bg-[#0D0D0F] transition-colors hover:border-[var(--primary)] disabled:opacity-50 disabled:cursor-wait"
          >
            <div className="absolute left-0 top-0 h-full w-2 opacity-50 transition-colors bg-[repeating-linear-gradient(-45deg,#52525B,#52525B_3px,transparent_3px,transparent_6px)] group-hover:bg-[repeating-linear-gradient(-45deg,var(--primary),var(--primary)_3px,transparent_3px,transparent_6px)]" />
            <div className="absolute right-0 top-0 h-full w-2 opacity-50 transition-colors bg-[repeating-linear-gradient(-45deg,#52525B,#52525B_3px,transparent_3px,transparent_6px)] group-hover:bg-[repeating-linear-gradient(-45deg,var(--primary),var(--primary)_3px,transparent_3px,transparent_6px)]" />
            
            {isAutoDetecting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--primary)]" />
                <span className="text-[10px] font-blender-medium uppercase tracking-wide text-[var(--primary)]">Синхронизация с API...</span>
              </div>
            ) : (
              <span className="text-[10px] font-blender-medium uppercase tracking-wide text-text-secondary transition-colors group-hover:text-[var(--primary)]">Автоматическое определение профиля игрока</span>
            )}
          </button>

          {/* КНОПКА СБРОСА ПРОГРЕССА */}
          <div className="flex w-full items-start justify-center gap-2 opacity-60 transition-opacity hover:opacity-100">
            <button onClick={() => setIsResetModalOpen(true)} className="flex h-7 flex-1 items-center justify-center gap-2 rounded border border-[#C24339] bg-[#C24339]/10 transition-colors hover:bg-[#C24339]/20 focus:outline-none">
              <div className="h-3 w-3 icon-mask icon-eft-profile-reset text-[#C24339]" />
              <span className="text-xs font-blender-medium leading-3 text-[#C24339]">СБРОС ПРОГРЕССА</span>
            </button>
            <div className="flex-1 text-[8px] font-blender-medium leading-[9px] text-[#C24339]">
              Внимание! После нажатия данной кнопки будет произведен полный сброс прогресса вашего ЧВК в игре!
            </div>
          </div>

        </div>
      </div>

      {/* Модальное окно подтверждения сброса */}
      <ProfileResetModal 
        isOpen={isResetModalOpen} 
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={() => {
          setLevel('1');
          setPrestige('0');
          setEdition('Standard');
          setFaction('USEC');
          setMode('PVE');
          setTraderLevels({ prapor: 1, therapist: 1, fence: 1, skier: 1, peacekeeper: 1, mechanic: 1, ragman: 1, jaeger: 1, ref: 1 });
          setIsResetModalOpen(false);
        }}
      />
    </div>
  );
}