'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ScanLine } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { ROLE_LABELS } from '@/lib/role-inference';
import { ROLE_HUBS } from '@/data/role-hubs';
import { ARCHETYPE_VISUALS } from '@/data/archetype-visuals';
import { RolePicker } from '@/components/features/adaptive/RolePicker';
import { useIsPve } from '@/hooks/useGameMode';
import { useSubscription } from '@/hooks/useSubscription';
import { useFirstVisitStore } from '@/store/useFirstVisitStore';
import { computeStanding } from '@/lib/player-standing';
import {
  DogTag,
  serviceNumberFrom,
  RankChevron,
  ArchetypeBadge,
  XpNotchBar,
  CompetencyRadar,
  RollUpCounter,
  StatusLed,
  StandingPanel,
  TacticalCard,
  usePlayerStandingSignals,
} from '@/components/features/profile';
import { TIERS } from '@/data/subscription-tiers';
import { getCurrentTier, getNextTier } from '@/types/gamification';
import { useGamificationStore } from '@/store/useGamificationStore';
import { HubCard } from '@/components/ui/HubCard';
import {
  operatorStatus,
  heroReadouts,
  profileHasFacts,
  dossierUnlocks,
  DOSSIER_SECTIONS,
  type KeyReadout,
} from './dossier-view';

/**
 * Серверные части сигналов, недоступные клиенту (карма — Drizzle owner-role). RSC-обёртка
 * (hub/page.tsx) читает их через getMe+getKarmaMap+getCompanionKarma и прокидывает сюда.
 * isAuthed отделяет «аноним» (localStorage-части видны, серверные → «войди») от сбоя.
 */
export interface HubServerProps {
  /** Залогинен ли пользователь на сервере (для мягкой деградации §4.5). */
  isAuthed: boolean;
  /** Карма comlink (сумма karma_events). null — аноним/сбой → вклад 0. */
  karmaComlink: number | null;
  /** Тир-лейбл кармы comlink (Дикий/Боец/Ветеран/Легенда). null — нет данных. */
  karmaComlinkTier: string | null;
  /** Карма companion (микро-грайнд). null — аноним/сбой. */
  karmaCompanion: number | null;
  /** Серверные читалки упали (Supabase недоступен) — панели в «—», но досье живёт. */
  serverError?: boolean;
}

const READOUT_FORMAT: Record<NonNullable<KeyReadout['kind']>, (n: number) => string> = {
  int: (n) => Math.round(n).toLocaleString('ru-RU'),
  percent: (n) => `${Math.round(n)}%`,
  hours: (n) => `${Math.round(n).toLocaleString('ru-RU')} ч`,
};

function HeroReadout({ readout }: { readout: KeyReadout }) {
  const fmt = readout.kind ? READOUT_FORMAT[readout.kind] : READOUT_FORMAT.int;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
        {readout.label}
      </span>
      <RollUpCounter value={readout.value} format={fmt} className="text-xl text-text-primary" />
    </div>
  );
}

/** Строка серверного readout кармы: значение / «войди» (аноним) / «—» (сбой). */
function ServerReadout({
  label,
  value,
  sub,
  isAuthed,
  serverError,
}: {
  label: string;
  value: number | null;
  sub?: string | null;
  isAuthed: boolean;
  serverError?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-type-caption font-blender-book text-text-secondary">{label}</span>
      {!isAuthed ? (
        <Link
          href="/login"
          className="text-type-micro font-blender-medium uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80"
        >
          Войди, чтобы связать
        </Link>
      ) : serverError || value == null ? (
        <span className="text-type-caption font-blender-medium tabular-nums tracking-wider text-text-muted">—</span>
      ) : (
        <span className="flex items-baseline gap-1.5">
          {sub && (
            <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
              {sub}
            </span>
          )}
          <span className="text-type-caption font-blender-medium tabular-nums tracking-wider text-text-primary">
            {value.toLocaleString('ru-RU')}
          </span>
        </span>
      )}
    </div>
  );
}

export function AdaptiveHubClient(props: HubServerProps = {
  isAuthed: false,
  karmaComlink: null,
  karmaComlinkTier: null,
  karmaCompanion: null,
}) {
  const { isAuthed, karmaComlink, karmaComlinkTier, karmaCompanion, serverError } = props;

  useEffect(() => {
    void useRoleStore.persist.rehydrate();
    void useGamificationStore.persist.rehydrate();
    void useFirstVisitStore.persist.rehydrate();
  }, []);

  const hydrated = useRoleStore((s) => s._hasHydrated);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const profile = usePlayerStore((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? null);
  const derived = useRoleStore((s) => s.byProfile[activeId]?.derived ?? null);
  const manualOverride = useRoleStore((s) => s.byProfile[activeId]?.manualOverride ?? null);
  const effectiveRole = useRoleStore((s) => effectiveRoleFor(s, activeId));
  const pve = useIsPve();
  const { tier } = useSubscription();

  // Онбординг-момент первого входа (не блокирующий, §4 R01/R18i): подсветить бейдж +
  // позвать в Путь Новобранца. Показываем, пока стор говорит «первый вход» и локально не
  // закрыто; пометку «просмотрено» ставим при закрытии (внешний стор апдейтим из обработчика,
  // не из эффекта → без setState-каскада и без чтения ref в рендере).
  const firstVisitHydrated = useFirstVisitStore((s) => s._hasHydrated);
  const isFirstVisit = useFirstVisitStore((s) => s.isFirstVisit);
  const markVisited = useFirstVisitStore((s) => s.markVisited);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const showOnboarding = firstVisitHydrated && isFirstVisit && !onboardingDismissed;
  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    markVisited();
  };

  // Сигналы standing (карма — с сервера, иначе вклад 0). Хук читает существующие сторы.
  const signals = usePlayerStandingSignals({ karmaComlink, karmaCompanion });
  const standing = computeStanding(signals);
  const xp = useGamificationStore((s) => s.xp);
  const currentTier = getCurrentTier(xp);
  const nextTier = getNextTier(xp);
  const unlocks = dossierUnlocks(standing, tier);

  if (!hydrated) {
    // Скелетон показывает форму будущего досье (§8) + скан-тик поверх пульса (критерий приёмки).
    return (
      <div className="flex flex-col gap-6">
        <div className="relative overflow-hidden rounded-xs">
          <div className="h-40 w-full animate-pulse rounded-xs bg-lines-hover" />
          <span
            aria-hidden
            className="animate-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-8"
            style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary) 30%, transparent), transparent)' }}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-56 w-full animate-pulse rounded-xs bg-lines-hover" />
          <div className="h-56 w-full animate-pulse rounded-xs bg-lines-hover" />
        </div>
      </div>
    );
  }

  const visual = ARCHETYPE_VISUALS[effectiveRole];
  const readouts = heroReadouts(profile);
  const hasFacts = profileHasFacts(profile);
  const status = operatorStatus(profile);
  const hub = ROLE_HUBS[effectiveRole];
  const level = profile ? Number.parseInt(profile.level, 10) : NaN;
  const prestige = profile ? Number.parseInt(profile.prestige, 10) : 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Онбординг-момент: мягкая плашка первого входа (не модалка-стоппер). */}
      {showOnboarding && (
        <div
          className="animate-[fade-in_0.5s_ease-out_both] flex items-start justify-between gap-4 rounded-xs border p-4"
          style={{
            borderColor: `color-mix(in srgb, ${visual.accent} 45%, transparent)`,
            background: `color-mix(in srgb, ${visual.accent} 8%, transparent)`,
          }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
              Добро пожаловать в досье
            </span>
            <p className="text-type-caption font-blender-book leading-4 text-text-secondary">
              Мы уже прикинули твой архетип — <span style={{ color: visual.accent }}>{ROLE_LABELS[effectiveRole].name}</span>. Он
              уточнится по мере игры, или задай его сам ниже. Начни с «Пути Новобранца».
            </p>
          </div>
          <button
            onClick={dismissOnboarding}
            className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
          >
            Ок
          </button>
        </div>
      )}

      {/* ── HERO-BAND: командная ID-карточка ─────────────────────────── */}
      <TacticalCard accent={visual.accent} active label="Досье оперативника">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <RankChevron level={Number.isFinite(level) ? level : null} prestige={Number.isFinite(prestige) ? prestige : 0} />
              <DogTag nickname={profile?.nickname} serviceNo={serviceNumberFrom(activeId)} faction={profile?.faction ?? null} />
            </div>
            <StatusLed status={status} />
          </div>

          <ArchetypeBadge
            primary={effectiveRole}
            secondary={derived?.secondary ?? null}
            confidence={manualOverride ? undefined : derived?.confidence}
            reasons={manualOverride ? ['выбрано вручную'] : (derived?.reasons ?? [])}
          />

          {/* Key-readouts: 4 крупных числа со счётчиком roll-up, либо CTA если профиль пуст. */}
          {hasFacts ? (
            <div className="grid grid-cols-2 gap-4 border-t border-lines-hover pt-4 sm:grid-cols-4">
              {readouts.map((r) => (
                <HeroReadout key={r.key} readout={r} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 border-t border-lines-hover pt-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {readouts.map((r) => (
                  <HeroReadout key={r.key} readout={r} />
                ))}
              </div>
              <p className="text-type-caption font-blender-book leading-4 text-text-secondary">
                Профиль ЧВК не заполнен — покажем уровень, рейды и выживаемость, как только добавишь данные.
              </p>
              <Link
                href="/eft/progress/rookie"
                className="inline-flex w-fit items-center gap-1.5 text-type-caption font-blender-medium uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80"
              >
                <ScanLine className="size-3.5" /> Добавить профиль / OCR скрина
              </Link>
            </div>
          )}

          <XpNotchBar
            percent={signals.xpProgress}
            tierLabel={`XP · ${currentTier.label}`}
            nextLabel={nextTier ? `След. тир: ${nextTier.label}` : 'Максимальный тир'}
          />
        </div>
      </TacticalCard>

      {/* ── РАДАР + STANDING ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TacticalCard accent={visual.accent} label="Радар компетенций">
          <div className="flex flex-col items-center gap-3">
            <CompetencyRadar
              axes={derived?.axes ?? { cautionAggression: 0, economyCombat: 0, sprintCollect: 0, soloClan: 0 }}
              accent={visual.accent}
              size={220}
            />
            {unlocks.detailedRadar ? (
              <p className="text-type-micro font-blender-book text-text-secondary">
                Оси считаются из твоего поведения на портале.
              </p>
            ) : (
              <p className="text-type-micro font-blender-book text-text-muted">
                Детальный разбор осей откроется с ростом ранга.
              </p>
            )}
          </div>
        </TacticalCard>

        <TacticalCard label="Боевая эффективность">
          <StandingPanel standing={standing} />
          {/* Серверные вклады: обе кармы + тир подписки (мягкая деградация §4.5). */}
          <div className="mt-4 flex flex-col gap-2 border-t border-lines-hover pt-3">
            <ServerReadout
              label="Карма (Связь)"
              value={karmaComlink}
              sub={karmaComlinkTier}
              isAuthed={isAuthed}
              serverError={serverError}
            />
            <ServerReadout
              label="Карма (Компаньон)"
              value={karmaCompanion}
              isAuthed={isAuthed}
              serverError={serverError}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-type-caption font-blender-book text-text-secondary">Тир подписки</span>
              <span className="text-type-micro font-blender-medium uppercase tracking-widest text-(--primary)">
                {TIERS[tier].name}
              </span>
            </div>
            {unlocks.standingHistory && (
              <Link
                href="/eft/progress/prestige"
                className="mt-1 inline-flex w-fit items-center gap-1.5 text-type-micro font-blender-medium uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80"
              >
                История и престиж <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
        </TacticalCard>
      </div>

      {/* ── СЕТКА РАЗДЕЛОВ ПРОГРЕССА ─────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          Разделы прогресса
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {DOSSIER_SECTIONS.map((s, i) => (
            <div key={s.id} className="animate-[fade-in-up_0.6s_ease-out_both]" style={{ animationDelay: `${i * 50}ms` }}>
              <HubCard
                gameId="eft"
                id={s.id}
                title={s.title}
                description={s.description}
                href={s.href}
                iconPath={s.iconPath}
                variant="rectangle"
                index={i}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── ПЕРСОНАЛЬНЫЙ ХАБ ПО РОЛИ ─────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-blender-medium uppercase tracking-widest text-(--primary)">
            Хаб: {ROLE_LABELS[effectiveRole].name}
          </h2>
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
            {manualOverride ? 'Выбрано вручную' : 'Авто-подбор'}
          </span>
        </div>
        {pve && (
          <div className="flex flex-col gap-1 rounded-xs border border-edition-tue bg-edition-tue/10 p-3">
            <span className="text-type-micro font-blender-medium uppercase tracking-widest text-edition-tue">Режим ПвЕ</span>
            <span className="text-type-caption font-blender-book leading-4 text-text-secondary">
              {hub.pveHint ?? 'Барахолка ограничена — упор на лут, крафты и сюжет, без гонки live-цен.'}
            </span>
          </div>
        )}
        <p className="text-sm font-blender-book text-text-secondary">{hub.intro}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {hub.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col gap-1 rounded-xs border border-lines-hover bg-(--color-base) p-4 transition-colors hover:border-(--primary)"
            >
              <span className="font-blender-medium text-xs uppercase tracking-wide text-text-primary">{link.title}</span>
              <span className="text-type-caption font-blender-book leading-4 text-text-secondary">{link.description}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── ROLE PICKER (переодетый) ─────────────────────────────────── */}
      <RolePicker />
    </div>
  );
}
