'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { ProfileSettingsModal } from './ProfileSettingsModal';

// Группа иконки уровня (1-16) — та же формула, что в PlayerTelemetry.
const getLevelGroup = (level: number) => {
  if (level < 5) return 1;
  return Math.min(16, Math.floor(level / 5) + 1);
};

/**
 * Мобильный блок статы/логина для дровера (бургер-меню).
 * Читает тот же usePlayerStore/useQuestStore, что и десктопный PlayerTelemetry,
 * но рендерит крупные тач-таблетки под макет. God-node PlayerTelemetry не трогаем.
 */
export function MobileMenuStats() {
  const router = useRouter();

  const { user } = useUser();
  const isAuthenticated = !!user;
  const supabaseRef = useRef(createClient());
  const handleSignOut = async () => {
    await supabaseRef.current.auth.signOut();
  };

  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const updateProfile = usePlayerStore((s) => s.updateProfile);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const tasks = useQuestStore((s) => s.tasks);
  const completedQuests = useQuestStore((s) => s.completedQuests);

  const [progressMode, setProgressMode] = useState<'KAPPA' | 'LIGHTKEEPER'>('KAPPA');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const stats = useMemo(() => {
    const done = new Set(completedQuests);
    const kappaTotal = tasks.filter((t) => t.kappaRequired).length;
    const kappaDone = tasks.filter((t) => t.kappaRequired && done.has(t.id)).length;
    const lkTotal = tasks.filter((t) => t.lightkeeperRequired).length;
    const lkDone = tasks.filter((t) => t.lightkeeperRequired && done.has(t.id)).length;
    return { kappaTotal, kappaDone, lkTotal, lkDone };
  }, [tasks, completedQuests]);

  const pct =
    progressMode === 'KAPPA'
      ? stats.kappaTotal > 0
        ? Math.round((stats.kappaDone / stats.kappaTotal) * 100)
        : 0
      : stats.lkTotal > 0
        ? Math.round((stats.lkDone / stats.lkTotal) * 100)
        : 0;

  const levelGroup = getLevelGroup(Number(activeProfile?.level) || 1);
  const isPvp = activeProfile?.mode === 'PVP';

  return (
    <div className="flex flex-col gap-2">
      {/* Ряд авторизации (только для залогиненных): имя · настройки · выход */}
      {isAuthenticated && (
        <div className="flex h-9 items-center justify-between rounded-sm border border-lines-hover bg-(--color-base) px-3">
          <span className="truncate text-[15px] font-blender-medium leading-none text-(--primary)">
            {activeProfile?.nickname || 'НЕТ ИМЕНИ'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Настройки"
              className="h-4 w-4 icon-mask icon-eft-profile-settings text-text-muted transition-colors hover:text-(--primary)"
            />
            <button
              onClick={() => void handleSignOut()}
              title="Выход"
              className="h-4 w-4 icon-mask icon-eft-profile-logout text-text-muted transition-colors hover:text-danger"
            />
          </div>
        </div>
      )}

      {/* Ряд статы: Прогресс · Режим · (Войти | Уровень+Фракция) */}
      <div className="grid grid-cols-3 gap-2">
        {/* Прогресс (тап — переключение Каппа/Смотритель) */}
        <button
          onClick={() => setProgressMode((m) => (m === 'KAPPA' ? 'LIGHTKEEPER' : 'KAPPA'))}
          className="flex h-12 items-center justify-center gap-1.5 rounded-sm border border-lines-hover bg-(--color-base) transition-colors hover:bg-card-menu"
        >
          <div
            className={`h-5 w-5 icon-bg shrink-0 ${progressMode === 'KAPPA' ? 'icon-eft-profile-kappa' : 'icon-eft-profile-lightkeeper'}`}
          />
          <span
            className={`text-sm font-blender-medium leading-none ${progressMode === 'KAPPA' ? 'text-tactical-amber' : 'text-accent-frago'}`}
          >
            {pct}%
          </span>
        </button>

        {/* Режим (тап — переключение PVP/PVE) */}
        <button
          onClick={() => activeProfile && updateProfile(activeProfile.id, { mode: isPvp ? 'PVE' : 'PVP' })}
          className={`flex h-12 items-center justify-center gap-1.5 rounded-sm border border-lines-hover bg-(--color-base) transition-colors ${isPvp ? 'hover:bg-mode-pvp/25' : 'hover:bg-mode-pve/25'}`}
        >
          <div className={`h-4.5 w-4.5 icon-bg shrink-0 ${isPvp ? 'icon-eft-profile-pvp' : 'icon-eft-profile-pve'}`} />
          <span
            className={`text-sm font-blender-medium uppercase leading-none ${isPvp ? 'text-mode-pvp' : 'text-mode-pve'}`}
          >
            {activeProfile?.mode || 'PVP'}
          </span>
        </button>

        {/* Авторизация: кнопка «Войти» или уровень+фракция */}
        {!isAuthenticated ? (
          <button
            onClick={() => router.push('/login')}
            className="flex h-12 items-center justify-center gap-1.5 rounded-sm bg-text-secondary transition-colors hover:bg-(--primary)"
          >
            <div className="h-3.5 w-3.5 icon-mask icon-eft-profile-login text-lines-hover" />
            <span className="text-sm font-blender-medium uppercase leading-none text-lines-hover">Войти</span>
          </button>
        ) : (
          <div className="flex h-12 items-center justify-center gap-1.5 rounded-sm border border-lines-hover bg-(--color-base)">
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
              <img
                src={
                  !activeProfile?.prestige || activeProfile.prestige === '0'
                    ? `/icons/eft/lvl-icons/player-level-group-${levelGroup}.webp`
                    : `/icons/eft/prestige/prestige-${activeProfile.prestige}.webp`
                }
                alt={`Level ${activeProfile?.level}`}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="text-sm font-blender-medium leading-none text-text-secondary">
                {activeProfile?.level || '1'}
              </span>
              <div
                className={`mt-0.5 h-3 w-6 icon-mask text-text-secondary ${activeProfile?.faction === 'BEAR' ? 'icon-eft-profile-bear-label' : 'icon-eft-profile-usec-label'}`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Модалка настроек профиля — та же, что у десктопного виджета */}
      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        edition={activeProfile?.edition || 'Standard'}
        setEdition={(val) => activeProfile && updateProfile(activeProfile.id, { edition: val })}
        faction={activeProfile?.faction || 'BEAR'}
        setFaction={(val) => activeProfile && updateProfile(activeProfile.id, { faction: val })}
        mode={activeProfile?.mode || 'PVP'}
        setMode={(val) => activeProfile && updateProfile(activeProfile.id, { mode: val })}
        nickname={activeProfile?.nickname || ''}
        setNickname={(val) => activeProfile && updateProfile(activeProfile.id, { nickname: val })}
        level={activeProfile?.level || '1'}
        setLevel={(val) => activeProfile && updateProfile(activeProfile.id, { level: val })}
        prestige={activeProfile?.prestige || '0'}
        setPrestige={(val) => activeProfile && updateProfile(activeProfile.id, { prestige: val })}
        traderLevels={activeProfile?.traderLevels || {}}
        setTraderLevels={(val) => activeProfile && updateProfile(activeProfile.id, { traderLevels: val })}
      />
    </div>
  );
}
