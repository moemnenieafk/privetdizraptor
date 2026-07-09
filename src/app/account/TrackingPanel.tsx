'use client';

// Вкладка «Трекинг» Аккаунт Центра — единый хаб прогресса игрока (v1: достижения EFT).
// Первый экран — вотчлист «отслеживаю» (мои цели + SMART-чипы «как добить»), ниже —
// обзор прогресса с разбивкой по официальной редкости. Структура мультигейм-ready:
// список секций по играм (пока одна — EFT). Решение: docs/decisions/player-tracking-tab.md.
// Данные достижений/подсказок приходят с сервера (account/page.tsx), трекинг — из
// useAchievementStore (mounted-гард против hydration mismatch).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, EyeOff, ArrowRight } from 'lucide-react';
import { useAchievementStore } from '@/store/useAchievementStore';
import { rarityMeta, type AchievementView, type AchRarity } from '@/lib/achievement-visuals';
import { achievementIconUrl, ACHIEVEMENT_ICON_FALLBACK } from '@/lib/achievement-icon';
import type { AchievementHint } from '@/lib/achievement-hints';
import { AchievementTrackToggle } from '@/components/features/achievements/AchievementTrackToggle';
import { AchievementResetControl } from '@/components/features/achievements/AchievementResetControl';
import { ResetControl } from '@/components/features/tracking/ResetControl';
import { MiniChip } from '@/components/features/achievements/HintChips';
import { resetCtaProgress } from '@/lib/cta-api';
import { clearProgressStorage } from '@/lib/progress-storage';
import { ProfileSettingsForm } from '@/components/layout/header-modules/ProfileSettingsModal';
import { usePlayerStore } from '@/store/usePlayerStore';
import { HideoutBuildTracker } from '@/components/features/hideout/HideoutBuildTracker';
import { TrackingPrestigeDigest } from './TrackingPrestigeDigest';
import { TrackingFavoritesDigest } from './TrackingFavoritesDigest';
import type { HideoutStationInfo } from '@/db/hideout';
import type { QuestsDigestData } from '@/lib/tracking-digest';
import type { HideoutNeed } from '@/db/hideout';
import { TrackingQuestsDigest } from './TrackingQuestsDigest';
import { TrackingItemsDigest } from './TrackingItemsDigest';
import { TrackingStoryDigest } from './TrackingStoryDigest';

// Реестр игр вкладки (мультиигровая статистика): новые игры добавляются записью сюда.
// available=false → таб-заглушка «скоро» (трекинг подключается по мере готовности страниц).
const TRACKING_GAMES = [
  { id: 'eft', logo: '/games/eft/eft-logo.svg', title: 'Escape From Tarkov', available: true },
  { id: 'abi', logo: '/games/abi/abi-logo.svg', title: 'Arena Breakout: Infinite', available: false },
  { id: 'gzw', logo: '/games/gzw/gzw-logo.svg', title: 'Gray Zone Warfare', available: false },
] as const;

type TrackingGameId = (typeof TRACKING_GAMES)[number]['id'];

// Домены трекинга внутри игры (суб-табы). Порядок утверждён V4DYA (2026-07-03).
// iconClass: '' → рендерится lucide Star (маски-звезды в icons.css нет).
const TRACKING_DOMAINS = [
  { id: 'pmc', label: 'Профиль ЧВК', iconClass: 'icon-eft-profile-settings' },
  { id: 'quests', label: 'Задания', iconClass: 'icon-eft-quests' },
  { id: 'story', label: 'Истории', iconClass: 'icon-eft-quests-lore' },
  { id: 'items', label: 'Предметы', iconClass: 'icon-eft-prog-items-needed' },
  { id: 'favorites', label: 'Избранное', iconClass: '' },
  { id: 'hideout', label: 'Убежище', iconClass: 'icon-eft-prog-hideout' },
  { id: 'achievements', label: 'Достижения', iconClass: 'icon-eft-prog-achievements' },
  { id: 'prestige', label: 'Престиж', iconClass: 'icon-eft-prog-prestige' },
] as const;

type TrackingDomainId = (typeof TRACKING_DOMAINS)[number]['id'];

const MAX_CHIPS = 4;

function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src.endsWith(ACHIEVEMENT_ICON_FALLBACK)) return;
  img.src = ACHIEVEMENT_ICON_FALLBACK;
}

// Метка-заголовок блока с линией (rule-micro-labels: text-type-micro).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
      <span className="h-px w-6 bg-lines-hover" />
      {children}
    </h3>
  );
}

// ─── Карточка вотчлиста ────────────────────────────────────────────────────────
function WatchCard({ a, hint }: { a: AchievementView; hint?: AchievementHint }) {
  const r = rarityMeta(a.normalizedRarity);
  const toggleTracked = useAchievementStore((s) => s.toggleTracked);
  const chips = hint?.links.slice(0, MAX_CHIPS) ?? [];

  return (
    <div className={`relative overflow-hidden rounded-lg border bg-card-menu p-4 ${r.borderClass}`}>
      {r.tintClass && <div className={`pointer-events-none absolute inset-0 ${r.tintClass}`} />}

      <div className="relative z-10 flex gap-4">
        <Link href={`/eft/progress/achievements/${a.id}`} className="h-16 w-16 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={achievementIconUrl(a.id)}
            alt={a.name}
            loading="lazy"
            onError={onImgError}
            className="h-full w-full object-contain transition-transform duration-300 hover:scale-110"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/eft/progress/achievements/${a.id}`}
              className="flex min-w-0 items-center gap-2 font-blender-medium text-base uppercase leading-tight text-text-primary transition-colors hover:text-(--primary)"
            >
              <span className="truncate">{a.name}</span>
              {a.hidden && <EyeOff className="h-4 w-4 shrink-0 text-text-primary/50" />}
            </Link>

            <div className="flex shrink-0 items-center gap-1">
              <AchievementTrackToggle id={a.id} variant="compact" />
              <span
                role="button"
                tabIndex={0}
                aria-label="Не отслеживать"
                title="Не отслеживать"
                onClick={() => toggleTracked(a.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTracked(a.id);
                  }
                }}
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded border border-(--primary)/60 bg-primary/15 text-(--primary) transition-colors hover:border-text-primary/50 hover:bg-transparent hover:text-text-primary/50"
              >
                <Star className="h-3.5 w-3.5 fill-current" />
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-xs px-1.5 py-0.5 text-type-micro uppercase tracking-widest ${r.badgeClass}`}>
              {r.label}
            </span>
            <span className="font-blender-medium text-type-micro text-text-primary/70">
              {a.playersCompletedPercent.toFixed(1)}% игроков
            </span>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((l) => (
                <MiniChip key={`${l.kind}:${l.href}`} link={l} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Панель ────────────────────────────────────────────────────────────────────
export function TrackingPanel({
  achievements,
  hints,
  questsDigest,
  hideoutNeeds,
  hideoutStations,
}: {
  achievements: AchievementView[];
  hints: Record<string, AchievementHint>;
  questsDigest: QuestsDigestData;
  hideoutNeeds: HideoutNeed[];
  hideoutStations: HideoutStationInfo[];
}) {
  // mounted-гард: persist-стор читаем только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const trackedIds = useAchievementStore((s) => s.trackedIds);
  const completedIds = useAchievementStore((s) => s.completedIds);

  const byId = useMemo(() => new Map(achievements.map((a) => [a.id, a])), [achievements]);
  const watch = useMemo(
    () =>
      mounted
        ? trackedIds.map((id) => byId.get(id)).filter((x): x is AchievementView => Boolean(x))
        : [],
    [mounted, trackedIds, byId],
  );
  const completedSet = useMemo(
    () => new Set(mounted ? completedIds : []),
    [mounted, completedIds],
  );

  const total = achievements.length;
  const doneTotal = useMemo(
    () => achievements.reduce((n, a) => n + (completedSet.has(a.id) ? 1 : 0), 0),
    [achievements, completedSet],
  );
  const donePct = total > 0 ? Math.round((doneTotal / total) * 100) : 0;

  const tiers = useMemo(
    () =>
      (['legendary', 'rare', 'common'] as AchRarity[]).map((key) => {
        const list = achievements.filter((a) => a.normalizedRarity === key);
        return {
          meta: rarityMeta(key),
          total: list.length,
          done: list.reduce((n, a) => n + (completedSet.has(a.id) ? 1 : 0), 0),
        };
      }),
    [achievements, completedSet],
  );

  const [activeGame, setActiveGame] = useState<TrackingGameId>('eft');
  const [activeDomain, setActiveDomain] = useState<TrackingDomainId>('pmc');
  const game = TRACKING_GAMES.find((g) => g.id === activeGame) ?? TRACKING_GAMES[0];

  // Профиль ЧВК: та же форма, что в модалке хедера — байндинг 1:1 на usePlayerStore.
  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const updateProfile = usePlayerStore((s) => s.updateProfile);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  return (
    <div className="flex flex-col gap-4">
      {/* ── Табы игр (мультиигровая статистика; недоступные — «скоро») ── */}
      <div className="flex flex-wrap gap-2">
        {TRACKING_GAMES.map((g) => {
          const isActive = g.id === activeGame;
          return (
            <button
              key={g.id}
              type="button"
              disabled={!g.available}
              onClick={() => g.available && setActiveGame(g.id)}
              title={g.available ? g.title : `${g.title} — скоро`}
              className={`group relative flex h-12 items-center justify-center rounded border px-5 transition-all duration-200 ${
                isActive
                  ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
                  : g.available
                    ? 'border-lines-hover bg-card-menu hover:border-text-secondary'
                    : 'cursor-not-allowed border-lines-hover bg-card-menu opacity-40'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.logo} alt={g.title} className={`h-6 w-auto object-contain ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-90'}`} />
              {!g.available && (
                <span className="absolute -top-1.5 right-2 rounded-xs bg-(--color-base) px-1 text-type-micro uppercase tracking-widest text-text-muted">
                  скоро
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Секция активной игры ── */}
      <div className="rounded border border-lines-hover bg-card-menu p-6">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-lines-hover pb-4">
          <span className="font-blender-medium text-xs uppercase tracking-widest text-text-muted">
            {game.title}
          </span>
          {/* Заглавный сброс: ВСЁ по игре (та же механика, что GameResetCard в Профиле) */}
          <ResetControl
            buttonLabel="СБРОС ПРОГРЕССА ИГРЫ"
            buttonTitle={`Сбросить весь прогресс: ${game.title}`}
            modalTitle="Подтверждение полного сброса игры"
            onConfirm={() => {
              void (async () => {
                const r = await resetCtaProgress();
                if (r.ok) {
                  clearProgressStorage();
                  window.location.reload();
                }
              })();
            }}
          >
            <p>
              Вы действительно хотите сбросить <span className="text-zinc-100">ВЕСЬ</span> прогресс
              в {game.title}?
            </p>
            <p>
              Будут очищены: задания, счётчики предметов, достижения, прогресс бартера, уровни
              убежища и игровые профили ЧВК. Данные удаляются и из облака —{' '}
              <span className="text-zinc-100">восстановить их нельзя</span>.
            </p>
            <p className="text-text-muted">Выполняется автоматически после вайпа</p>
          </ResetControl>
        </div>

        {/* ── Суб-табы доменов ── */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          {TRACKING_DOMAINS.map((d) => {
            const isActive = d.id === activeDomain;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveDomain(d.id)}
                className={`group flex h-9 items-center gap-2 rounded border px-3 transition-all duration-200 ${
                  isActive
                    ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] text-(--primary)'
                    : 'border-lines-hover bg-(--color-base) text-text-muted hover:border-text-secondary hover:text-text-primary'
                }`}
              >
                {d.iconClass ? (
                  <span
                    className={`h-4 w-4 shrink-0 icon-mask ${d.iconClass} ${
                      isActive ? 'bg-(--primary)' : 'bg-text-muted group-hover:bg-text-primary'
                    }`}
                  />
                ) : (
                  <Star
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-(--primary)' : 'text-text-muted group-hover:text-text-primary'
                    }`}
                  />
                )}
                <span className="font-blender-medium text-type-micro uppercase tracking-widest">
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>

        {activeDomain === 'pmc' && (
          /* Ширина 1:1 как в модалке хедера (w-87 = 348px) — форму не растягиваем */
          <div className="mx-auto w-full max-w-87">
            <ProfileSettingsForm
              edition={activeProfile?.edition || 'Standard'} setEdition={(val) => activeProfile && updateProfile(activeProfile.id, { edition: val })}
              faction={activeProfile?.faction || 'BEAR'} setFaction={(val) => activeProfile && updateProfile(activeProfile.id, { faction: val })}
              mode={activeProfile?.mode || 'PVP'} setMode={(val) => activeProfile && updateProfile(activeProfile.id, { mode: val })}
              nickname={activeProfile?.nickname || ''} setNickname={(val) => activeProfile && updateProfile(activeProfile.id, { nickname: val })}
              level={activeProfile?.level || '1'} setLevel={(val) => activeProfile && updateProfile(activeProfile.id, { level: val })}
              prestige={activeProfile?.prestige || '0'} setPrestige={(val) => activeProfile && updateProfile(activeProfile.id, { prestige: val })}
              traderLevels={activeProfile?.traderLevels || {}} setTraderLevels={(val) => activeProfile && updateProfile(activeProfile.id, { traderLevels: val })}
            />
          </div>
        )}
        {activeDomain === 'quests' && <TrackingQuestsDigest digest={questsDigest} />}
        {activeDomain === 'story' && <TrackingStoryDigest />}
        {activeDomain === 'items' && (
          <TrackingItemsDigest itemRequirements={questsDigest.itemRequirements} />
        )}
        {activeDomain === 'favorites' && <TrackingFavoritesDigest />}
        {activeDomain === 'hideout' && (
          <HideoutBuildTracker stations={hideoutStations} hideoutNeeds={hideoutNeeds} />
        )}
        {activeDomain === 'prestige' && <TrackingPrestigeDigest />}

        {activeDomain === 'achievements' && (
        <>
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
            Достижения:{' '}
            <span className="text-success">{mounted ? doneTotal : 0}</span>
            <span className="text-text-muted"> / {total}</span>
          </span>
          <AchievementResetControl />
        </div>

        {/* ── Вотчлист «отслеживаю» ── */}
        <SectionLabel>Отслеживаю · {watch.length}</SectionLabel>

        {watch.length > 0 ? (
          <div className="flex flex-col gap-3">
            {watch.map((a) => (
              <WatchCard key={a.id} a={a} hint={hints[a.id]} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-8 text-center">
            <Star className="h-6 w-6 text-text-muted" />
            <p className="max-w-90 text-sm text-text-secondary">
              Вотчлист пуст. Отмечайте достижения кнопкой «Отслеживать» — цели и подсказки, как их
              добить, соберутся здесь.
            </p>
            <Link
              href="/eft/progress/achievements"
              className="inline-flex items-center gap-2 rounded border border-lines-hover px-4 py-2 font-blender-medium text-type-label uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              К достижениям
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── Обзор прогресса по редкости ── */}
        <div className="mt-8">
          <SectionLabel>Прогресс</SectionLabel>

          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-primary/50">
              Выполнено всего
            </span>
            <span className="font-blender-medium text-xs text-text-primary">
              {mounted ? doneTotal : 0} / {total}
              <span className="ml-2 text-text-primary/50">{mounted ? donePct : 0}%</span>
            </span>
          </div>
          <div className="mb-6 h-2 overflow-hidden rounded-xs bg-(--color-base)">
            <div
              className="h-full rounded-xs bg-success transition-[width] duration-500"
              style={{ width: `${mounted ? donePct : 0}%` }}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tiers.map((t) => {
              const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
              return (
                <div key={t.meta.key} className="rounded-lg border border-lines-hover bg-(--color-base) p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-xs px-1.5 py-0.5 text-type-micro uppercase tracking-widest ${t.meta.badgeClass}`}>
                      {t.meta.label}
                    </span>
                    <span className="font-blender-medium text-type-micro text-text-primary/70">
                      {mounted ? t.done : 0} / {t.total}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-xs bg-card-menu">
                    <div
                      className={`h-full rounded-xs transition-[width] duration-500 ${t.meta.barClass}`}
                      style={{ width: `${mounted ? pct : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
