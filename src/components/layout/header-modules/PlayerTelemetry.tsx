'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getHeaderConfig } from '@/data/headerConfig';
import { ProfileSettingsModal, EDITIONS, EditionType } from './ProfileSettingsModal';
import { usePlayerStore } from '@/store/usePlayerStore';
import { ProfileDeleteModal } from './ProfileDeleteModal';

// Функция вычисления группы иконки уровня (1-16)
const getLevelGroup = (level: number) => {
  if (level < 5) return 1;
  return Math.min(16, Math.floor(level / 5) + 1);
};

export function PlayerTelemetry() {
  const pathname = usePathname();
  const config = getHeaderConfig(pathname || '');

  // Временные стейты для демонстрации верстки
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [progressMode, setProgressMode] = useState<'KAPPA' | 'LIGHTKEEPER'>('KAPPA');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Глобальное хранилище Zustand
  const profiles = usePlayerStore((state) => state.profiles);
  const activeProfileId = usePlayerStore((state) => state.activeProfileId);
  const setActiveProfileId = usePlayerStore((state) => state.setActiveProfileId);
  const addProfile = usePlayerStore((state) => state.addProfile);
  const updateProfile = usePlayerStore((state) => state.updateProfile);
  const deleteProfile = usePlayerStore((state) => state.deleteProfile);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  // Стейты меню профиля
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [contextMenuProfileId, setContextMenuProfileId] = useState<string | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const telemetryRef = useRef<HTMLDivElement>(null);

  // Закрытие выпадающего меню при клике вне его области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (telemetryRef.current && !telemetryRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
        setContextMenuProfileId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const levelGroup = getLevelGroup(Number(activeProfile?.level) || 1);
  const activeEd = EDITIONS[activeProfile?.edition || 'Standard'];

  return (
    <div ref={telemetryRef} className={`relative flex flex-col bg-[#0D0D0F] rounded-sm border border-[#222225] transition-all duration-300 ${isAuthenticated ? 'h-[60px] w-[220px]' : 'h-[36px] w-[220px]'}`}>

      {/* СЕКЦИЯ 4: Верхняя панель (Только для авторизованных) */}
      {isAuthenticated && (
        <>
          <div className="flex items-center justify-between w-full h-[24px] px-2">
            <div 
              className="flex items-center gap-1.5 cursor-pointer flex-1 h-full group"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            >
              <div className={`w-4 h-4 icon-mask ${activeEd.icon} ${activeEd.color} transition-colors group-hover:text-[var(--primary)]`} />
              <span className={`${activeEd.color} text-[13px] font-blender-medium leading-none transition-colors group-hover:text-[var(--primary)]`}>{activeProfile?.nickname || 'НЕТ ИМЕНИ'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsSettingsOpen(true)} className="w-3 h-3 flex items-center justify-center group focus:outline-none" title="Настройки">
                <div className="w-full h-full icon-mask icon-eft-profile-settings text-[#52525B] transition-colors group-hover:text-[var(--primary)]" />
              </button>
              <button onClick={() => setIsAuthenticated(false)} className="w-3 h-3 flex items-center justify-center group focus:outline-none" title="Выход">
                <div className="w-full h-full icon-mask icon-eft-profile-logout text-[#52525B] transition-colors group-hover:text-[var(--primary)]" />
              </button>
            </div>
          </div>

          {/* ВЫПАДАЮЩЕЕ МЕНЮ ПРОФИЛЕЙ (OVERLAY) */}
          {isProfileMenuOpen && (
            <div className="absolute top-[-1px] left-[-1px] flex flex-col w-[220px] z-[100] bg-[#0D0D0F] border border-[#222225] rounded-sm shadow-2xl animate-[fade-in_0.1s_ease-out_both]">
              
              {/* Шапка меню (Закрывает меню при клике) */}
              <div className="flex h-[24px] w-full items-center gap-1.5 rounded-t-sm bg-[#222225] px-2 cursor-pointer" onClick={() => setIsProfileMenuOpen(false)}>
                <div className="flex h-4 w-4 items-center justify-center shrink-0">
                  <div className="h-full w-full icon-mask icon-eft-profile-btn-account text-zinc-100" />
                </div>
                <span className="text-[10px] font-blender-medium leading-[10px] text-zinc-100 uppercase mt-0.5">Ваши профили ЧВК</span>
              </div>

              {/* Список профилей */}
              <div className="flex w-full flex-col items-center overflow-hidden rounded-b-sm bg-[#0D0D0F]">
                {profiles.map((profile, index) => {
                  const isCurrent = profile.id === activeProfileId;
                  const profEd = EDITIONS[profile.edition];
                  const profLevelGroup = getLevelGroup(Number(profile.level));
                  
                  return (
                    <div key={profile.id} className="w-full relative">
                      {index > 0 && <div className="h-px w-full bg-[#222225]" />}
                      <div 
                        onClick={() => {
                          setActiveProfileId(profile.id);
                          setIsProfileMenuOpen(false);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenuProfileId(profile.id);
                        }}
                        className={`flex h-11 w-full cursor-pointer items-center transition-all duration-200 ${isCurrent ? 'bg-[#222225]' : 'opacity-50 hover:bg-[#161618] hover:opacity-100'}`}
                      >
                        {/* Иконка издания */}
                        <div className="flex w-7 items-center justify-center shrink-0">
                          <div className={`h-3.5 w-3.5 icon-mask ${profEd.icon} ${profEd.color}`} />
                        </div>
                        {/* Никнейм */}
                        <div className={`flex-1 text-[15px] font-blender-medium leading-none ${profEd.color} truncate pr-1`}>{profile.nickname}</div>
                        {/* Престиж и Уровень */}
                        <div className="flex h-9 w-[76px] shrink-0 items-center justify-center gap-1.5 pr-2 pl-1">
                          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                            {!profile.prestige || profile.prestige === '0' ? (
                              <img src={`/icons/eft/lvl-icons/player-level-group-${profLevelGroup}.webp`} alt="Level" className="h-full w-full object-contain" />
                            ) : (
                              <img src={`/icons/eft/prestige/prestige-${profile.prestige}.webp`} alt="Prestige" className="h-full w-full object-contain" />
                            )}
                          </div>
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-[16px] font-blender-medium leading-4 text-[#9CA3AF]">{profile.level}</span>
                            <div className="mt-[1px] flex h-[12px] items-center justify-center rounded-[3px] border border-[#9CA3AF] px-1">
                              <span className="text-[8px] font-bold uppercase leading-none tracking-wide text-[#9CA3AF]">{profile.faction}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Контекстное меню удаления */}
                      {contextMenuProfileId === profile.id && (
                        <>
                          <div className="fixed inset-0 z-[105]" onClick={(e) => { e.stopPropagation(); setContextMenuProfileId(null); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenuProfileId(null); }} />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] bg-[#161618] border border-[#222225] rounded-sm shadow-xl p-1 w-32 animate-[fade-in_0.1s_ease-out_both]">
                            <button 
                              className="flex items-center justify-center gap-2 px-2 py-2 hover:bg-[#C24339]/10 rounded-sm transition-colors group/delete w-full"
                              disabled={profiles.length <= 1} // Отключаем, если профиль единственный
                              onClick={(e) => {
                                e.stopPropagation();
                              setProfileToDelete(profile.id);
                                setContextMenuProfileId(null);
                              }}
                            >
                                <div className="w-3.5 h-3.5 icon-mask icon-eft-profile-btn-remove bg-[#9CA3AF] group-hover/delete:bg-[#C24339] transition-colors shrink-0" />
                                <span className="text-xs font-blender-medium uppercase text-[#9CA3AF] group-hover/delete:text-[#C24339] transition-colors whitespace-nowrap mt-0.5">Удалить ЧВК</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                <div className="h-px w-full bg-[#222225]" />

                {/* Нижние кнопки */}
                <div className="flex w-full flex-col py-1">
                  <button 
                    onClick={() => { addProfile(); setIsProfileMenuOpen(false); }}
                    disabled={profiles.length >= 5}
                    className={`flex h-7 w-full items-center justify-start gap-2 px-2 transition-colors group/btn ${profiles.length >= 5 ? 'opacity-50 cursor-not-allowed bg-black/20' : 'hover:bg-[#161618]'}`}>
                    <div className="flex h-3 w-3 items-center justify-center shrink-0">
                      <div className="h-full w-full icon-mask icon-eft-profile-btn-add bg-[#9CA3AF] transition-colors group-hover/btn:bg-[var(--primary)]" />
                    </div>
                    <span className="text-[13px] font-blender-medium uppercase leading-none text-[#9CA3AF] transition-colors group-hover/btn:text-[var(--primary)] mt-0.5">Добавить ЧВК</span>
                  </button>
                  <button onClick={() => { setIsSettingsOpen(true); setIsProfileMenuOpen(false); }} className="flex h-7 w-full items-center justify-start gap-2 px-2 transition-colors hover:bg-[#161618] group/btn">
                    <div className="flex h-3 w-3 items-center justify-center shrink-0">
                      <div className="h-full w-full icon-mask icon-eft-profile-settings bg-[#9CA3AF] transition-colors group-hover/btn:bg-[var(--primary)]" />
                    </div>
                    <span className="text-[13px] font-blender-medium uppercase leading-none text-[#9CA3AF] transition-colors group-hover/btn:text-[var(--primary)] mt-0.5">Настройки</span>
                  </button>
                  <button className="flex h-7 w-full items-center justify-start gap-2 px-2 transition-colors hover:bg-[#161618] group/btn">
                    <div className="flex h-3 w-3 items-center justify-center shrink-0">
                      <div className="h-full w-full icon-mask icon-eft-profile-btn-account bg-[#9CA3AF] transition-colors group-hover/btn:bg-[var(--primary)]" />
                    </div>
                    <span className="text-[13px] font-blender-medium uppercase leading-none text-[#9CA3AF] transition-colors group-hover/btn:text-[var(--primary)] mt-0.5">Аккаунт Центр</span>
                  </button>
                  <button onClick={() => { setIsAuthenticated(false); setIsProfileMenuOpen(false); }} className="flex h-7 w-full items-center justify-start gap-2 px-2 transition-colors hover:bg-[#161618] group/btn">
                    <div className="flex h-3 w-3 items-center justify-center shrink-0">
                      <div className="h-full w-full icon-mask icon-eft-profile-logout bg-[#9CA3AF] transition-colors group-hover/btn:bg-[#C24339]" />
                    </div>
                    <span className="text-[13px] font-blender-medium uppercase leading-none text-[#9CA3AF] transition-colors group-hover/btn:text-[#C24339] mt-0.5">Выйти</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ОСНОВНАЯ ПАНЕЛЬ (Автоматически занимает оставшуюся высоту) */}
      <div className="flex items-center flex-1 w-full">

        {/* СЕКЦИЯ 1: Блок прогресса (Ширина 79px) */}
        <div className="group relative flex h-full w-[79px] cursor-default items-center justify-between px-2 hover:bg-[#161618] transition-colors rounded-bl-sm">
          <div className={`w-5 h-5 icon-bg shrink-0 transition-transform duration-300 group-hover:scale-110 ${progressMode === 'KAPPA' ? 'icon-eft-profile-kappa' : 'icon-eft-profile-lightkeeper'}`} />
          <div className="flex flex-col items-end justify-center">
            <span className={`text-[8px] font-blender-medium uppercase leading-none opacity-50 tracking-tight transition-colors ${progressMode === 'KAPPA' ? 'text-[#E68E25]' : 'text-[#00CDAB]'}`}>Прогресс</span>
            <span className={`text-xs font-normal font-blender-medium uppercase leading-none transition-colors ${progressMode === 'KAPPA' ? 'text-[#E68E25]' : 'text-[#00CDAB]'}`}>{isAuthenticated ? '100%' : '0%'}</span>
          </div>

          {/* Выпадающий список Прогресса */}
          <div className="absolute top-[calc(100%+4px)] left-[-1px] hidden group-hover:flex flex-col w-[220px] bg-[#161618] border border-[#222225] rounded-sm z-50 shadow-lg">
            {/* Невидимый мост для мыши */}
            <div className="absolute -top-2 left-0 h-2 w-full bg-transparent" />
            <div className="flex flex-col py-1">
              
              {/* Переключаемые пункты */}
              <div 
                className={`px-2 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${progressMode === 'KAPPA' ? 'bg-[#E68E25]/15' : 'hover:bg-[#E68E25]/10'}`}
                onClick={() => setProgressMode('KAPPA')}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 icon-bg icon-eft-profile-kappa" />
                  <span className="text-sm font-blender-medium uppercase text-[#E68E25]">Каппа</span>
                </div>
                <span className="text-sm font-blender-medium text-[#E68E25]">{isAuthenticated ? '260/260' : '0/260'}</span>
              </div>
              <div 
                className={`px-2 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${progressMode === 'LIGHTKEEPER' ? 'bg-[#00CDAB]/15' : 'hover:bg-[#00CDAB]/10'}`}
                onClick={() => setProgressMode('LIGHTKEEPER')}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 icon-bg icon-eft-profile-lightkeeper" />
                  <span className="text-sm font-blender-medium uppercase text-[#00CDAB]">Смотритель</span>
                </div>
                <span className="text-sm font-blender-medium text-[#00CDAB]">{isAuthenticated ? '8/8' : '0/8'}</span>
              </div>

              <div className="h-px w-full bg-[#222225] my-0.5 shrink-0" />
              
              {/* Торговцы */}
              <div className="flex flex-col">
                {[
                  { id: 'prapor', name: 'Прапор', icon: 'icon-eft-quests-prapor', total: 66 },
                  { id: 'therapist', name: 'Терапевт', icon: 'icon-eft-quests-therapist', total: 48 },
                  { id: 'fence', name: 'Скупщик', icon: 'icon-eft-quests-fence', total: 1 },
                  { id: 'skier', name: 'Лыжник', icon: 'icon-eft-quests-skier', total: 54 },
                  { id: 'peacekeeper', name: 'Миротворец', icon: 'icon-eft-quests-peacekeeper', total: 59 },
                  { id: 'mechanic', name: 'Механик', icon: 'icon-eft-quests-mechanic', total: 81 },
                  { id: 'ragman', name: 'Барахольщик', icon: 'icon-eft-quests-ragman', total: 55 },
                  { id: 'jaeger', name: 'Егерь', icon: 'icon-eft-quests-jaeger', total: 61 },
                  { id: 'ref', name: 'Реф', icon: 'icon-eft-quests-ref', total: 20 },
                  { id: 'lightkeeper', name: 'Смотритель Маяка', icon: 'icon-eft-quests-lightkeeper', total: 23 },
                  { id: 'btrdriver', name: 'Водитель БТР', icon: 'icon-eft-quests-btrdriver', total: 0 },
                ].map(trader => (
                  <div key={trader.id} className="px-2 py-1 flex items-center justify-between hover:bg-[#0D0D0F] text-[#9CA3AF] hover:text-[var(--primary)] transition-colors cursor-pointer group/trader">
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 icon-bg ${trader.icon} opacity-50 group-hover/trader:opacity-100 transition-opacity`} />
                      <span className="text-[11px] font-blender-medium uppercase">{trader.name}</span>
                    </div>
                    <span className="text-[11px] font-blender-medium">{isAuthenticated ? trader.total : 0}/{trader.total}</span>
                  </div>
                ))}
              </div>

              <div className="h-px w-full bg-[#222225] my-0.5 shrink-0" />
              
              {/* Все задания */}
              <div className="px-2 py-1.5 flex items-center justify-between hover:bg-[#0D0D0F] text-[#9CA3AF] hover:text-[var(--primary)] transition-colors cursor-pointer shrink-0">
                <span className="text-xs font-blender-medium uppercase">Все задания</span>
                <span className="text-xs font-blender-medium">{isAuthenticated ? '467/467' : '0/467'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Вертикальный разделитель */}
        <div className="w-px h-6 bg-[#222225] shrink-0" />

        {/* СЕКЦИЯ 2: Блок режима (Ширина 64px) */}
        <div className={`group relative flex h-full w-[64px] cursor-pointer items-center justify-center transition-colors ${activeProfile?.mode === 'PVP' ? 'hover:bg-[#9A8866]/25' : 'hover:bg-[#0095E2]/25'}`}>
          <div className="flex items-center gap-1">
            <div className={`w-[18px] h-[18px] icon-bg transition-colors ${activeProfile?.mode === 'PVP' ? 'icon-eft-profile-pvp' : 'icon-eft-profile-pve'}`} />
            <div className="flex flex-col items-start justify-center">
              <span className={`text-[8px] font-blender-medium uppercase leading-none opacity-50 tracking-tight transition-colors ${activeProfile?.mode === 'PVP' ? 'text-[#9A8866]' : 'text-[#0095E2]'}`}>Режим</span>
              <span className={`text-xs font-normal font-blender-medium uppercase leading-none transition-colors ${activeProfile?.mode === 'PVP' ? 'text-[#9A8866]' : 'text-[#0095E2]'}`}>{activeProfile?.mode}</span>
            </div>
          </div>

          {/* Выпадающий список Режимов */}
          <div className="absolute top-[calc(100%+4px)] left-[-1px] hidden group-hover:flex flex-col w-[66px] bg-[#161618] border border-[#222225] rounded-sm z-50 shadow-lg">
            {/* Невидимый мост для мыши */}
            <div className="absolute -top-2 left-0 h-2 w-full bg-transparent" />
            <div onClick={() => activeProfile && updateProfile(activeProfile.id, { mode: 'PVE' })} className="flex items-center justify-center gap-1 py-1.5 hover:bg-[#0095E2]/25 transition-colors cursor-pointer">
              <div className="w-[18px] h-[18px] icon-bg icon-eft-profile-pve transition-colors" />
              <div className="flex flex-col items-start justify-center">
                <span className="text-[#0095E2] text-[8px] font-blender-medium uppercase leading-none opacity-50 tracking-tight transition-colors">Режим</span>
                <span className="text-[#0095E2] text-xs font-normal font-blender-medium uppercase leading-none transition-colors">PVE</span>
              </div>
            </div>
            <div onClick={() => activeProfile && updateProfile(activeProfile.id, { mode: 'PVP' })} className="flex items-center justify-center gap-1 py-1.5 hover:bg-[#9A8866]/25 transition-colors cursor-pointer">
              <div className="w-[18px] h-[18px] icon-bg icon-eft-profile-pvp transition-colors" />
              <div className="flex flex-col items-start justify-center">
                <span className="text-[#9A8866] text-[8px] font-blender-medium uppercase leading-none opacity-50 tracking-tight transition-colors">Режим</span>
                <span className="text-[#9A8866] text-xs font-normal font-blender-medium uppercase leading-none transition-colors">PVP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Вертикальный разделитель */}
        <div className="w-px h-6 bg-[#222225] shrink-0" />

        {/* СЕКЦИЯ 3: Блок авторизации (Ширина 76px) */}
        <div className="flex w-[76px] h-full items-center justify-center rounded-br-sm">
          {!isAuthenticated ? (
            <button onClick={() => setIsAuthenticated(true)} className="flex h-[20px] w-[56px] items-center justify-center gap-1 rounded-[2px] bg-[#9CA3AF] transition-colors hover:bg-[var(--primary)] focus:outline-none">
              <div className="h-[10px] w-[10px] icon-mask icon-eft-profile-login text-[#222225]" />
              <span className="text-[10px] font-blender-medium font-bold uppercase leading-none text-[#222225]">Войти</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2 cursor-pointer group transition-opacity">
              {/* Иконка престижа/уровня с подтягиванием картинки из локальной папки */}
              <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
                {!activeProfile?.prestige || activeProfile?.prestige === '0' ? (
                  <img 
                    src={`/icons/eft/lvl-icons/player-level-group-${levelGroup}.webp`} 
                    alt={`Level ${activeProfile?.level}`} 
                    className="w-full h-full object-contain" 
                  />
                ) : (
                  <img 
                    src={`/icons/eft/prestige/prestige-${activeProfile?.prestige}.webp`} 
                    alt={`Prestige ${activeProfile?.prestige}`} 
                    className="w-full h-full object-contain" 
                  />
                )}
              </div>
              
              {/* Уровень и фракция */}
              <div className="flex flex-col items-center justify-center">
                {/* Уровень игрока */}
                <span className="text-[#9CA3AF] text-[16px] font-blender-medium leading-4 transition-colors group-hover:text-[var(--primary)]">
                  {activeProfile?.level || '1'}
                </span>
                
                {/* Плашка фракции (через CSS-рамку, а не абсолютные слои) */}
                <div className="mt-[1px] flex h-[12px] items-center justify-center rounded-[3px] border border-[#9CA3AF] px-1 transition-colors group-hover:border-[var(--primary)]">
                  <span className="text-[#9CA3AF] text-[8px] font-bold uppercase tracking-wide leading-none transition-colors group-hover:text-[var(--primary)]">
                    {activeProfile?.faction}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Модальное окно настроек */}
      <ProfileSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        edition={activeProfile?.edition || 'Standard'} setEdition={(val) => activeProfile && updateProfile(activeProfile.id, { edition: val })}
        faction={activeProfile?.faction || 'BEAR'} setFaction={(val) => activeProfile && updateProfile(activeProfile.id, { faction: val })}
        mode={activeProfile?.mode || 'PVP'} setMode={(val) => activeProfile && updateProfile(activeProfile.id, { mode: val })}
        nickname={activeProfile?.nickname || ''} setNickname={(val) => activeProfile && updateProfile(activeProfile.id, { nickname: val })}
        level={activeProfile?.level || '1'} setLevel={(val) => activeProfile && updateProfile(activeProfile.id, { level: val })}
        prestige={activeProfile?.prestige || '0'} setPrestige={(val) => activeProfile && updateProfile(activeProfile.id, { prestige: val })}
        traderLevels={activeProfile?.traderLevels || {}} setTraderLevels={(val) => activeProfile && updateProfile(activeProfile.id, { traderLevels: val })}
      />

      {/* Модальное окно удаления ЧВК */}
      <ProfileDeleteModal
        isOpen={!!profileToDelete}
        onClose={() => setProfileToDelete(null)}
        onConfirm={() => {
          if (profileToDelete) {
            deleteProfile(profileToDelete);
          }
        }}
      />
    </div>
  );
}