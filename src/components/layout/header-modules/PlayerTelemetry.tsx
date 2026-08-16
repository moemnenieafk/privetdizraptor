'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getHeaderConfig } from '@/data/headerConfig';
import { ProfileSettingsModal, EDITIONS, EditionType } from './ProfileSettingsModal';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useQuestStore } from '@/store/useQuestStore';
import { ProfileDeleteModal } from './ProfileDeleteModal';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';

// Функция вычисления группы иконки уровня (1-16)
const getLevelGroup = (level: number) => {
  if (level < 5) return 1;
  return Math.min(16, Math.floor(level / 5) + 1);
};

export function PlayerTelemetry() {
  const pathname = usePathname();
  const router   = useRouter();
  const config = getHeaderConfig(pathname || '');

  // Реальная авторизация: статус из сессии Supabase (хук useUser).
  const { user } = useUser();
  const isAuthenticated = !!user;
  const supabaseRef = useRef(createClient());
  const handleLogin = () => router.push('/login');
  const handleSignOut = async () => {
    await supabaseRef.current.auth.signOut();
    // useUser перехватит SIGNED_OUT через onAuthStateChange → виджет свернётся.
  };

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

  const tasks          = useQuestStore((s) => s.tasks);
  const completedQuests = useQuestStore((s) => s.completedQuests);

  const questStats = useMemo(() => {
    const completedSet = new Set(completedQuests);

    const kappaTotal     = tasks.filter(t => t.kappaRequired).length;
    const kappaCompleted = tasks.filter(t => t.kappaRequired && completedSet.has(t.id)).length;
    const lkTotal        = tasks.filter(t => t.lightkeeperRequired).length;
    const lkCompleted    = tasks.filter(t => t.lightkeeperRequired && completedSet.has(t.id)).length;

    const byTrader = new Map<string, { total: number; completed: number }>();
    for (const task of tasks) {
      const key   = task.trader.normalizedName;
      const entry = byTrader.get(key) ?? { total: 0, completed: 0 };
      entry.total++;
      if (completedSet.has(task.id)) entry.completed++;
      byTrader.set(key, entry);
    }

    return { kappaTotal, kappaCompleted, lkTotal, lkCompleted, byTrader };
  }, [tasks, completedQuests]);

  // Стейты меню профиля
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [contextMenuProfileId, setContextMenuProfileId] = useState<string | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const telemetryRef = useRef<HTMLDivElement>(null);

  // Закрытие выпадающих меню при клике/тапе вне виджета
  useClickOutside(telemetryRef, () => {
    setIsProfileMenuOpen(false);
    setContextMenuProfileId(null);
    setIsProgressOpen(false);
  }, isProfileMenuOpen || contextMenuProfileId !== null || isProgressOpen);

  const levelGroup = getLevelGroup(Number(activeProfile?.level) || 1);
  const activeEd = EDITIONS[activeProfile?.edition || 'Standard'];

  return (
    <div ref={telemetryRef} className={`relative flex flex-col bg-(--color-base) rounded-sm border border-lines-hover transition-all duration-300 ${isAuthenticated ? 'h-15 w-40' : 'h-9 w-40'}`}>

      {/* СЕКЦИЯ 4: Верхняя панель (Только для авторизованных) */}
      {isAuthenticated && (
        <>
          <div className="flex items-center justify-between w-full h-6 px-2">
            <div 
              className="flex items-center gap-1.5 cursor-pointer flex-1 h-full group"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            >
              <div className={`w-4 h-4 icon-mask ${activeEd.icon} ${activeEd.color} transition-colors group-hover:text-(--primary)`} />
              <span className={`${activeEd.color} text-type-label font-blender-medium leading-none transition-colors group-hover:text-(--primary)`}>{activeProfile?.nickname || 'НЕТ ИМЕНИ'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsSettingsOpen(true)} className="w-3 h-3 flex items-center justify-center group focus:outline-none" title="Настройки">
                <div className="w-full h-full icon-mask icon-eft-profile-settings text-text-muted transition-colors group-hover:text-(--primary)" />
              </button>
              <button onClick={handleSignOut} className="w-3 h-3 flex items-center justify-center group focus:outline-none" title="Выход">
                <div className="w-full h-full icon-mask icon-eft-profile-logout text-text-muted transition-colors group-hover:text-(--primary)" />
              </button>
            </div>
          </div>

          {/* ВЫПАДАЮЩЕЕ МЕНЮ ПРОФИЛЕЙ (OVERLAY) */}
          {isProfileMenuOpen && (
            <div className="absolute -top-px -left-px flex flex-col w-55 z-30 bg-(--color-base) border border-lines-hover rounded-sm shadow-2xl animate-[fade-in_0.1s_ease-out_both]">
              
              {/* Шапка меню (Закрывает меню при клике) */}
              <div className="flex h-6 w-full items-center gap-1.5 rounded-t-sm bg-lines-hover px-2 cursor-pointer" onClick={() => setIsProfileMenuOpen(false)}>
                <div className="flex h-4 w-4 items-center justify-center shrink-0">
                  <div className="h-full w-full icon-mask icon-eft-profile-btn-account text-zinc-100" />
                </div>
                <span className="text-type-caption font-blender-medium leading-2.5 text-zinc-100 uppercase mt-0.5">Ваши профили ЧВК</span>
              </div>

              {/* Список профилей */}
              <div className="flex w-full flex-col items-center overflow-hidden rounded-b-sm bg-(--color-base)">
                {profiles.map((profile, index) => {
                  const isCurrent = profile.id === activeProfileId;
                  const profEd = EDITIONS[profile.edition];
                  const profLevelGroup = getLevelGroup(Number(profile.level));
                  
                  return (
                    <div key={profile.id} className="w-full relative">
                      {index > 0 && <div className="h-px w-full bg-lines-hover" />}
                      <div 
                        onClick={() => {
                          setActiveProfileId(profile.id);
                          setIsProfileMenuOpen(false);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenuProfileId(profile.id);
                        }}
                        className={`flex h-11 w-full cursor-pointer items-center transition-all duration-200 ${isCurrent ? 'bg-lines-hover' : 'opacity-50 hover:bg-card-menu hover:opacity-100'}`}
                      >
                        {/* Иконка издания */}
                        <div className="flex w-7 items-center justify-center shrink-0">
                          <div className={`h-3.5 w-3.5 icon-mask ${profEd.icon} ${profEd.color}`} />
                        </div>
                        {/* Никнейм */}
                        <div className={`flex-1 text-[0.9375rem] font-blender-medium leading-none ${profEd.color} truncate pr-1`}>{profile.nickname}</div>
                        {/* Престиж и Уровень */}
                        <div className="flex h-9 w-19 shrink-0 items-center justify-center gap-1.5 pr-2 pl-1">
                          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                            {!profile.prestige || profile.prestige === '0' ? (
                              <img src={`/icons/eft/lvl-icons/player-level-group-${profLevelGroup}.webp`} alt="Level" className="h-full w-full object-contain" />
                            ) : (
                              <img src={`/icons/eft/prestige/prestige-${profile.prestige}.webp`} alt="Prestige" className="h-full w-full object-contain" />
                            )}
                          </div>
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-base font-blender-medium leading-4 text-text-secondary">{profile.level}</span>
                            <div className="mt-px flex h-3 items-center justify-center rounded-[3px] border border-text-secondary px-1">
                              <span className="text-type-caption uppercase leading-none tracking-wide text-text-secondary">{profile.faction}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Контекстное меню удаления */}
                      {contextMenuProfileId === profile.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setContextMenuProfileId(null); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenuProfileId(null); }} />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card-menu border border-lines-hover rounded-sm shadow-xl p-1 w-32 animate-[fade-in_0.1s_ease-out_both]">
                            <button 
                              className="flex items-center justify-center gap-2 px-2 py-2 hover:bg-danger/10 rounded-sm transition-colors group/delete w-full"
                              disabled={profiles.length <= 1} // Отключаем, если профиль единственный
                              onClick={(e) => {
                                e.stopPropagation();
                              setProfileToDelete(profile.id);
                                setContextMenuProfileId(null);
                              }}
                            >
                                <div className="w-3.5 h-3.5 icon-mask icon-eft-profile-btn-remove bg-text-secondary group-hover/delete:bg-danger transition-colors shrink-0" />
                                <span className="text-xs font-blender-medium uppercase text-text-secondary group-hover/delete:text-danger transition-colors whitespace-nowrap mt-0.5">Удалить ЧВК</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                <div className="h-px w-full bg-lines-hover" />

                {/* Нижние кнопки */}
                <div className="flex w-full flex-col py-1">
                  <button 
                    onClick={() => { addProfile(); setIsProfileMenuOpen(false); }}
                    disabled={profiles.length >= 5}
                    className={`flex h-7 w-full items-center justify-start gap-2 px-2 transition-colors group/btn ${profiles.length >= 5 ? 'opacity-50 cursor-not-allowed bg-black/20' : 'hover:bg-card-menu'}`}>
                    <div className="flex h-3 w-3 items-center justify-center shrink-0">
                      <div className="h-full w-full icon-mask icon-eft-profile-btn-add bg-text-secondary transition-colors group-hover/btn:bg-(--primary)" />
                    </div>
                    <span className="text-type-label font-blender-medium uppercase leading-none text-text-secondary transition-colors group-hover/btn:text-(--primary) mt-0.5">Добавить ЧВК</span>
                  </button>
                  <button onClick={() => { setIsSettingsOpen(true); setIsProfileMenuOpen(false); }} className="flex h-7 w-full items-center justify-start gap-2 px-2 transition-colors hover:bg-card-menu group/btn">
                    <div className="flex h-3 w-3 items-center justify-center shrink-0">
                      <div className="h-full w-full icon-mask icon-eft-profile-settings bg-text-secondary transition-colors group-hover/btn:bg-(--primary)" />
                    </div>
                    <span className="text-type-label font-blender-medium uppercase leading-none text-text-secondary transition-colors group-hover/btn:text-(--primary) mt-0.5">Настройки</span>
                  </button>
                  <Link
                    href="/eft/progress/rookie/path"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex h-7 w-full items-center justify-start gap-2 px-2 transition-colors hover:bg-card-menu group/btn"
                  >
                    <div className="flex h-3 w-3 items-center justify-center shrink-0">
                      <div className="h-full w-full icon-mask icon-eft-utarkov bg-text-secondary transition-colors group-hover/btn:bg-(--primary)" />
                    </div>
                    <span className="text-type-label font-blender-medium uppercase leading-none text-text-secondary transition-colors group-hover/btn:text-(--primary) mt-0.5">Путь Новобранца</span>
                  </Link>
                  <Link
                    href="/account"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex h-7 w-full items-center justify-start gap-2 px-2 transition-colors hover:bg-card-menu group/btn"
                  >
                    <div className="flex h-3 w-3 items-center justify-center shrink-0">
                      <div className="h-full w-full icon-mask icon-account_profile_icon bg-text-secondary transition-colors group-hover/btn:bg-(--primary)" />
                    </div>
                    <span className="text-type-label font-blender-medium uppercase leading-none text-text-secondary transition-colors group-hover/btn:text-(--primary) mt-0.5">Аккаунт Центр</span>
                  </Link>
                  <button onClick={() => { void handleSignOut(); setIsProfileMenuOpen(false); }} className="flex h-7 w-full items-center justify-start gap-2 px-2 transition-colors hover:bg-card-menu group/btn">
                    <div className="flex h-3 w-3 items-center justify-center shrink-0">
                      <div className="h-full w-full icon-mask icon-eft-profile-logout bg-text-secondary transition-colors group-hover/btn:bg-danger" />
                    </div>
                    <span className="text-type-label font-blender-medium uppercase leading-none text-text-secondary transition-colors group-hover/btn:text-danger mt-0.5">Выйти</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ОСНОВНАЯ ПАНЕЛЬ (Автоматически занимает оставшуюся высоту) */}
      <div className="flex items-center flex-1 w-full">

        {/* СЕКЦИЯ 1: Блок прогресса */}
        <div
          className="group relative flex h-full w-19 cursor-pointer items-center justify-center gap-1.5 hover:bg-card-menu transition-colors rounded-bl-sm"
          onClick={() => setIsProgressOpen((v) => !v)}
        >
          <div className={`w-5 h-5 icon-bg shrink-0 transition-transform duration-300 group-hover:scale-110 ${progressMode === 'KAPPA' ? 'icon-eft-profile-kappa' : 'icon-eft-profile-lightkeeper'}`} />
          <span className={`text-xs font-blender-medium uppercase leading-none transition-colors ${progressMode === 'KAPPA' ? 'text-tactical-amber' : 'text-accent-frago'}`}>
            {progressMode === 'KAPPA'
              ? `${questStats.kappaTotal > 0 ? Math.round(questStats.kappaCompleted / questStats.kappaTotal * 100) : 0}%`
              : `${questStats.lkTotal > 0 ? Math.round(questStats.lkCompleted / questStats.lkTotal * 100) : 0}%`
            }
          </span>

          {/* Выпадающий список Прогресса */}
          <div className={`absolute top-[calc(100%+4px)] -left-px flex-col w-55 bg-card-menu border border-lines-hover rounded-sm z-20 shadow-lg ${isProgressOpen ? 'flex' : 'hidden group-hover:flex'}`}>
            {/* Невидимый мост для мыши */}
            <div className="absolute -top-2 left-0 h-2 w-full bg-transparent" />
            <div className="flex flex-col py-1">
              
              {/* Переключаемые пункты */}
              <div 
                className={`px-2 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${progressMode === 'KAPPA' ? 'bg-tactical-amber/15' : 'hover:bg-tactical-amber/10'}`}
                onClick={() => setProgressMode('KAPPA')}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 icon-bg icon-eft-profile-kappa" />
                  <span className="text-sm font-blender-medium uppercase text-tactical-amber">Каппа</span>
                </div>
                <span className="text-sm font-blender-medium text-tactical-amber">{questStats.kappaCompleted}/{questStats.kappaTotal}</span>
              </div>
              <div 
                className={`px-2 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${progressMode === 'LIGHTKEEPER' ? 'bg-accent-frago/15' : 'hover:bg-accent-frago/10'}`}
                onClick={() => setProgressMode('LIGHTKEEPER')}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 icon-bg icon-eft-profile-lightkeeper" />
                  <span className="text-sm font-blender-medium uppercase text-accent-frago">Смотритель</span>
                </div>
                <span className="text-sm font-blender-medium text-accent-frago">{questStats.lkCompleted}/{questStats.lkTotal}</span>
              </div>

              <div className="h-px w-full bg-lines-hover my-0.5 shrink-0" />
              
              {/* Торговцы */}
              <div className="flex flex-col">
                {([
                  { id: 'prapor',      slug: 'prapor',      name: 'Прапор',           icon: 'icon-eft-quests-prapor'      },
                  { id: 'therapist',   slug: 'therapist',   name: 'Терапевт',          icon: 'icon-eft-quests-therapist'   },
                  { id: 'fence',       slug: 'fence',       name: 'Скупщик',           icon: 'icon-eft-quests-fence'       },
                  { id: 'skier',       slug: 'skier',       name: 'Лыжник',            icon: 'icon-eft-quests-skier'       },
                  { id: 'peacekeeper', slug: 'peacekeeper', name: 'Миротворец',        icon: 'icon-eft-quests-peacekeeper' },
                  { id: 'mechanic',    slug: 'mechanic',    name: 'Механик',           icon: 'icon-eft-quests-mechanic'    },
                  { id: 'ragman',      slug: 'ragman',      name: 'Барахольщик',       icon: 'icon-eft-quests-ragman'      },
                  { id: 'jaeger',      slug: 'jaeger',      name: 'Егерь',             icon: 'icon-eft-quests-jaeger'      },
                  { id: 'ref',         slug: 'ref',         name: 'Реф',               icon: 'icon-eft-quests-ref'         },
                  { id: 'lightkeeper', slug: 'lightkeeper', name: 'Смотритель Маяка',  icon: 'icon-eft-quests-lightkeeper' },
                  { id: 'btrdriver',   slug: 'btrdriver',   name: 'Водитель БТР',      icon: 'icon-eft-quests-btrdriver'   },
                ] as const).map(trader => {
                  const ts        = questStats.byTrader.get(trader.id);
                  const total     = ts?.total ?? 0;
                  const completed = ts?.completed ?? 0;
                  return (
                    <div
                      key={trader.id}
                      className="px-2 py-1 flex items-center justify-between hover:bg-(--color-base) text-text-secondary hover:text-(--primary) transition-colors cursor-pointer group/trader"
                      onClick={() => {
                        setIsProgressOpen(false);
                        router.push(`/eft/progress/quests?trader=${trader.slug}`);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 icon-bg ${trader.icon} opacity-50 group-hover/trader:opacity-100 transition-opacity`} />
                        <span className="text-type-caption font-blender-medium uppercase">{trader.name}</span>
                      </div>
                      <span className="text-type-caption font-blender-medium">{completed}/{total}</span>
                    </div>
                  );
                })}
              </div>

              <div className="h-px w-full bg-lines-hover my-0.5 shrink-0" />
              
              {/* Все задания */}
              <div className="px-2 py-1.5 flex items-center justify-between hover:bg-(--color-base) text-text-secondary hover:text-(--primary) transition-colors cursor-pointer shrink-0">
                <span className="text-xs font-blender-medium uppercase">Все задания</span>
                <span className="text-xs font-blender-medium">{completedQuests.length}/{tasks.length || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Вертикальный разделитель */}
        <div className="w-px h-6 bg-lines-hover shrink-0" />

        {/* СЕКЦИЯ 2 (выбор режима PvP/PvE) — убрана из телеметрии (pred-mvp).
            Режим по-прежнему меняется в ProfileSettingsModal. */}

        {/* СЕКЦИЯ 3: Блок авторизации */}
        <div className="flex w-19 h-full items-center justify-center rounded-br-sm">
          {!isAuthenticated ? (
            <button onClick={handleLogin} className="flex h-5 w-14 items-center justify-center gap-1 rounded-xs bg-text-secondary transition-colors hover:bg-(--primary) focus:outline-none">
              <div className="h-2.5 w-2.5 icon-mask icon-eft-profile-login text-lines-hover" />
              <span className="text-type-micro font-blender-medium uppercase leading-none text-lines-hover">Войти</span>
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
                <span className="text-xs font-blender-medium leading-none text-text-secondary transition-colors group-hover:text-(--primary)">
                  {activeProfile?.level || '1'}
                </span>
                <div
                  className={`mt-0.5 w-6 h-3 icon-mask text-text-secondary transition-colors group-hover:text-(--primary) ${activeProfile?.faction === 'BEAR' ? 'icon-eft-profile-bear-label' : 'icon-eft-profile-usec-label'}`}
                />
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
        hoursPlayed={activeProfile?.hoursPlayed ?? null} setHoursPlayed={(val) => activeProfile && updateProfile(activeProfile.id, { hoursPlayed: val })}
        raids={activeProfile?.raids ?? null} setRaids={(val) => activeProfile && updateProfile(activeProfile.id, { raids: val })}
        survivalRate={activeProfile?.survivalRate ?? null} setSurvivalRate={(val) => activeProfile && updateProfile(activeProfile.id, { survivalRate: val })}
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