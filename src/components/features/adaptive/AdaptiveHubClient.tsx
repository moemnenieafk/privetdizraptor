'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { ROLE_LABELS } from '@/lib/role-inference';
import { ARCHETYPE_VISUALS } from '@/data/archetype-visuals';
import { ARCHETYPE_FEATURES } from '@/data/feature-catalog';
import { ArchetypePicker } from '@/components/features/adaptive/ArchetypePicker';
import { ArchetypeFeatureGrid } from '@/components/features/adaptive/ArchetypeFeatureGrid';
import { DossierHubNav } from '@/components/features/adaptive/DossierHubNav';
import { DogTagProfileCard } from '@/components/features/adaptive/DogTagProfileCard';
import { DossierUploadBlock } from '@/components/features/adaptive/DossierUploadBlock';
import { DossierPmcStats } from '@/components/features/adaptive/DossierPmcStats';
import { HexRingProgress } from '@/components/features/adaptive/HexRingProgress';
import { useIsPve } from '@/hooks/useGameMode';
import { useSubscription } from '@/hooks/useSubscription';
import { useAchievementStore } from '@/store/useAchievementStore';
import { useFirstVisitStore } from '@/store/useFirstVisitStore';
import { computeStanding } from '@/lib/player-standing';
import {
  XpNotchBar,
  CompetencyRadar,
  RollUpCounter,
  usePlayerStandingSignals,
} from '@/components/features/profile';
import { TIERS } from '@/data/subscription-tiers';
import { getCurrentTier, getNextTier } from '@/types/gamification';
import { useGamificationStore } from '@/store/useGamificationStore';
import { useXpStore } from '@/store/useXpStore';
import { subTrackLevel } from '@/lib/xp';
import {
  dossierUnlocks,
  statGrid,
  survivalRingPercent,
  experienceValue,
  radarAxes5,
  earnedContributions,
  type StatCell,
} from './dossier-view';

/**
 * Серверные части сигналов, недоступные клиенту (карма — Drizzle owner-role). RSC-обёртка
 * (hub/page.tsx) читает их через getMe+getKarmaMap+getCompanionKarma и прокидывает сюда.
 * isAuthed отделяет «аноним» (localStorage-части видны, серверные → «войди») от сбоя.
 */
export interface HubServerProps {
  /** Залогинен ли пользователь на сервере (для мягкой деградации §4.5). */
  isAuthed: boolean;
  /** Карма comlink (сумма karma_events). null — аноним/сбой → репутация «—». */
  karmaComlink: number | null;
  /** Тир-лейбл кармы comlink (Дикий/Боец/Ветеран/Легенда). null — нет данных. */
  karmaComlinkTier: string | null;
  /** Карма companion (микро-грайнд). null — аноним/сбой. */
  karmaCompanion: number | null;
  /** Серверные читалки упали (Supabase недоступен) — карма в «—», но досье живёт. */
  serverError?: boolean;
}

/** Формат значения стат-ячейки: целое с разделителями либо коэффициент (K/O 0.71). */
function formatStat(cell: StatCell): (n: number) => string {
  return cell.kind === 'ratio'
    ? (n) => n.toFixed(2)
    : (n) => Math.round(n).toLocaleString('ru-RU');
}

/** Ячейка стата: вертикальный стек [иконка → лейбл → число] (раскладка V4DYA) —
 *  живёт в 4-колоночной стат-сетке досье, ширину задаёт grid-ячейка. */
function StatCellView({ cell }: { cell: StatCell }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className={`icon-mask size-7 bg-text-secondary ${cell.iconClass}`} aria-hidden />
      <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
        {cell.label}
      </span>
      <RollUpCounter value={cell.value} format={formatStat(cell)} className="text-lg text-text-primary" />
    </div>
  );
}

/** Кольцо выживаемости (донат-progress) + подпись в центре. null → пустое кольцо. */
function SurvivalRing({ percent, accent }: { percent: number | null; accent: string }) {
  const size = 128;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const dash = (pct / 100) * circ;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Выживаемость">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-lines-hover)" strokeWidth={stroke} />
        {percent != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-2xl font-blender-medium tabular-nums" style={{ color: accent }}>
          {percent == null ? '—' : `${Math.round(pct)}%`}
        </span>
        <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          Выживаний
        </span>
      </div>
    </div>
  );
}

/** Строка вклада боевой эффективности (лейбл слева, +значение справа). */
function ContribRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 truncate text-type-caption font-blender-book uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      <span
        className={`shrink-0 text-type-caption font-blender-medium tabular-nums tracking-wider ${
          value > 0 ? 'text-(--primary)' : 'text-text-muted'
        }`}
      >
        {value > 0 ? `+${value.toLocaleString('ru-RU')}` : '—'}
      </span>
    </div>
  );
}

/** Микро-заголовок блока правой панели с линией (§ rule-micro-labels). */
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
        {children}
      </span>
      <div className="h-px flex-1 bg-lines-hover" />
    </div>
  );
}

/** Разъяснение осей радара эффективности (что значит каждая ось, под графиком). */
const RADAR_AXIS_LEGEND: ReadonlyArray<{ label: string; desc: string }> = [
  { label: 'Бой', desc: 'Уклон в бой и стрельбу против экономики и торговли.' },
  { label: 'Агрессия', desc: 'Игра на контакт и напор против осторожной, выжидательной.' },
  { label: 'Добыча', desc: 'Вдумчивый сбор лута против скоростного пробега рейда.' },
  { label: 'Выживание', desc: 'Доля выживших рейдов из профиля ЧВК (нет данных — из K/D).' },
  { label: 'Отряд', desc: 'Командная игра в отряде против соло.' },
];

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
    void useXpStore.persist.rehydrate();
  }, []);

  const hydrated = useRoleStore((s) => s._hasHydrated);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const profile = usePlayerStore((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? null);
  const derived = useRoleStore((s) => s.byProfile[activeId]?.derived ?? null);
  const manualOverride = useRoleStore((s) => s.byProfile[activeId]?.manualOverride ?? null);
  const effectiveRole = useRoleStore((s) => effectiveRoleFor(s, activeId));
  const pve = useIsPve();
  const { tier } = useSubscription();
  const achievements = useAchievementStore((s) => s.completedIds.length);

  // Под-трек архетипа (XP-слой): mount-гейт своего persist-стора — до регидрации чип не рендерим.
  const xpHydrated = useXpStore((s) => s._hasHydrated);
  const subTrackXp = useXpStore((s) => s.subTracks[effectiveRole] ?? 0);
  const subTrack = subTrackLevel(subTrackXp);

  // Онбординг-момент первого входа (не блокирующий, §4 R01/R18i).
  const firstVisitHydrated = useFirstVisitStore((s) => s._hasHydrated);
  const isFirstVisit = useFirstVisitStore((s) => s.isFirstVisit);
  const markVisited = useFirstVisitStore((s) => s.markVisited);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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
          <div className="h-24 w-full animate-pulse rounded-xs bg-lines-hover" />
          <span
            aria-hidden
            className="animate-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-8"
            style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary) 30%, transparent), transparent)' }}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-96 w-full animate-pulse rounded-xs bg-lines-hover" />
          <div className="h-96 w-full animate-pulse rounded-xs bg-lines-hover" />
        </div>
      </div>
    );
  }

  const visual = ARCHETYPE_VISUALS[effectiveRole];
  const roleLabel = ROLE_LABELS[effectiveRole];
  const level = profile ? Number.parseInt(profile.level, 10) : NaN;
  const prestige = profile ? Number.parseInt(profile.prestige, 10) : 0;

  const cells = statGrid(profile, achievements);
  const survival = survivalRingPercent(profile);
  const expValue = experienceValue(profile);
  const radarSpokes = radarAxes5(derived?.axes ?? null, profile);
  const earned = earnedContributions(standing);
  // Карта лейблов earned-вкладов под макет (XP-ТИР (БАРТЕР) / ДОСТИЖЕНИЯ / ПУТЬ НОВОБРАНЦА / АРКАДА).
  const EARNED_LABELS: Record<string, string> = {
    xp: 'XP-тир (бартер)',
    achievements: 'Достижения',
    tutorial: 'Путь новобранца',
    arcade: 'Аркада',
  };

  // Тир подписки: платный (operative/veteran) = PRO-статус (корона на макете).
  const isPro = tier !== 'free';

  return (
    <div className="flex flex-col gap-8">
      {/* ── ШАПКА: HubNav досье ───────────────────────────────────────── */}
      <DossierHubNav
        title="Досье игрока"
        description="Единый тактический экран: архетип, боевая эффективность и весь прогресс в одном месте. Портал подстраивается под тебя — доверься авто-подбору или задай роль сам."
        iconUrl="/icons/eft/04-progression/utarkov.svg"
      />

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
              Мы уже прикинули твой архетип — <span style={{ color: visual.accent }}>{roleLabel.name}</span>. Он
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

      {/* ── ВЕРХНЯЯ СЕТКА: [портрет+статы | центр-карта+разделы] · правая панель ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ЛЕВО+ЦЕНТР */}
        <div className="flex flex-col gap-8">
          {/* Верхний ряд: [портрет 160 · жетон 288 · блок загрузки 208] — все 160px, переносятся на узких. */}
          <div className="flex flex-wrap items-start gap-6">
            {/* Портрет ЧВК (плейсхолдер: у профиля нет поля портрета — фракц-силуэт архетипа). */}
            <div
              className="relative flex size-40 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-lines-hover bg-(--color-darkbase)"
            >
              <span
                className="icon-mask size-24 opacity-30"
                style={{
                  backgroundColor: visual.accent,
                  WebkitMaskImage: `url(${visual.iconClass})`,
                  maskImage: `url(${visual.iconClass})`,
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                }}
                aria-hidden
              />
              {profile?.faction && (
                <span className="absolute bottom-2 left-2 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                  {profile.faction}
                </span>
              )}
            </div>

            {/* Карточка-жетон идентичности (1:1 Figma, 288×160) */}
            <DogTagProfileCard
              nickname={profile?.nickname ?? null}
              faction={profile?.faction ?? null}
              edition={profile?.edition ?? 'Standard'}
              level={Number.isFinite(level) ? level : null}
              prestige={Number.isFinite(prestige) ? prestige : 0}
              pve={pve}
            />

            {/* Блок загрузки статистики (208×160) — точка входа для profile.json */}
            <DossierUploadBlock />
          </div>

          {/* ── СТАТ-БЛОК: две колонки (раскладка V4DYA), без фона/обводки.
              Колонка 1 — кольцо выживаемости + ячейка игрового опыта (EXP+ для PRO / EXP для обычного издания).
              Колонка 2 — 8 стат-ячеек ЧВК сеткой 2 ряда × 4; каждая ячейка — стек [иконка → лейбл → число]. */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
              {/* Колонка 1: кольцо выживаемости + игровой опыт под ним */}
              <div className="flex shrink-0 flex-col items-center gap-4">
                <SurvivalRing percent={survival} accent={visual.accent} />
                {/* Индикатор опыта: иконка (exp+ для PRO / exp для обычного) + кол-во опыта */}
                <div className="flex items-center justify-center gap-2">
                  <span
                    className={`icon-mask size-6 shrink-0 bg-(--primary) ${isPro ? 'icon-eft-stat-experienceplus' : 'icon-eft-stat-experience'}`}
                    aria-hidden
                  />
                  <RollUpCounter value={expValue} className="text-lg text-text-primary" />
                </div>
              </div>

              {/* Колонка 2: 8 стат-ячеек — 2 ряда по 4 */}
              <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
                {cells.map((cell) => (
                  <StatCellView key={cell.key} cell={cell} />
                ))}
              </div>
            </div>
          </div>

          {/* ИЗБРАННЫЕ РАЗДЕЛЫ АРХЕТИПА: грид иконок + список названий (Figma 2868-5301). */}
          <ArchetypeFeatureGrid featureIds={ARCHETYPE_FEATURES[effectiveRole]} />

          {/* ── ДЕТАЛЬНАЯ СТАТА ЧВК: навыки / мастерство / рейды (профиль-гейт: пусто → нет секции) ── */}
          <DossierPmcStats />
        </div>

        {/* ── ПРАВАЯ ПАНЕЛЬ: прокачка ──────────────────────────────────── */}
        <aside className="relative flex flex-col gap-5 rounded-lg bg-(--color-darkbase) p-5">
          {/* Бейдж архетипа: гекс-иконка + «ЦТА АРХЕТИП» + имя роли */}
          <div className="flex items-center gap-3">
            <HexRingProgress
              progress={manualOverride ? 1 : (derived?.confidence ?? 0)}
              accent={visual.accent}
              iconClass={visual.iconClass}
              size={56}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <img
                src="/icons/eft/04-progression/cta-profile/title_archetype.svg"
                alt="ЦТА · Архетип"
                className="h-4 w-auto"
              />
              <span className="truncate text-lg font-blender-medium uppercase tracking-widest" style={{ color: visual.accent }}>
                «{roleLabel.name}»
              </span>

              {/* Уровень под-трека архетипа (глубина XP-слоя) + тонкий прогресс-бар. */}
              {xpHydrated && (
                <div className="mt-1 flex flex-col gap-1">
                  <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                    {roleLabel.name} · ур. {subTrack.level}
                  </span>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-lines-hover">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${Math.round(subTrack.progress * 100)}%`, backgroundColor: visual.accent }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Триггер пикера архетипа (Figma 2861-1952): угол панели у гекс-кольца */}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label="Выбрать архетип"
              className="ml-auto shrink-0"
            >
              <span
                className="icon-mask size-5 bg-text-muted transition-colors hover:bg-tactical-amber"
                style={{
                  WebkitMaskImage: 'url(/icons/eft/04-progression/cta-profile/select-archetype-icon.svg)',
                  maskImage: 'url(/icons/eft/04-progression/cta-profile/select-archetype-icon.svg)',
                }}
                aria-hidden
              />
            </button>
          </div>

          {/* Тир подписки */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
              Тир подписки
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-sm font-blender-medium uppercase tracking-widest text-(--primary)">
                {TIERS[tier].name}
              </span>
              {isPro && (
                <span
                  className="icon-mask icon-account_prostatus_icon size-4 bg-tactical-amber"
                  role="img"
                  aria-label="PRO"
                />
              )}
            </span>
          </div>

          {/* Боевая эффективность — ЗАРАБОТАННЫЕ вклады */}
          <div>
            <PanelLabel>Боевая эффективность</PanelLabel>
            <div className="mb-2 flex items-end justify-between gap-3">
              <span className="text-sm font-blender-medium uppercase tracking-widest text-(--primary)">
                {standing.tierLabel}
              </span>
              <RollUpCounter value={standing.total} className="text-xl text-text-primary" />
            </div>
            <div className="flex flex-col gap-1.5">
              {earned.map((c) => (
                <ContribRow key={c.key} label={EARNED_LABELS[c.key] ?? c.label} value={c.value} />
              ))}
            </div>
            {unlocks.standingHistory && (
              <Link
                href="/eft/progress/prestige"
                className="mt-2 inline-flex w-fit items-center gap-1.5 text-type-micro font-blender-medium uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80"
              >
                История и престиж <ArrowRight className="size-3" />
              </Link>
            )}
          </div>

          {/* Карма — серверная репутация (ОТДЕЛЬНО от боевой эффективности) */}
          <div>
            <PanelLabel>Карма</PanelLabel>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-type-caption font-blender-book uppercase tracking-wide text-text-secondary">Ранг</span>
                {!isAuthed ? (
                  <Link href="/login" className="text-type-micro font-blender-medium uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80">
                    Войди
                  </Link>
                ) : (
                  <span className="text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">
                    {serverError || karmaComlinkTier == null ? '—' : karmaComlinkTier}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-type-caption font-blender-book uppercase tracking-wide text-text-secondary">Репутация</span>
                {!isAuthed ? (
                  <span className="text-type-caption font-blender-medium tabular-nums text-text-muted">—</span>
                ) : (
                  <span className="text-type-caption font-blender-medium tabular-nums tracking-wider text-text-primary">
                    {serverError || karmaComlink == null ? '—' : `+${karmaComlink.toLocaleString('ru-RU')}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Радар эффективности — 5 осей */}
          <div>
            <PanelLabel>Радар эффективности</PanelLabel>
            <div className="flex justify-center">
              <CompetencyRadar spokes={radarSpokes} accent={visual.accent} size={240} />
            </div>

            {/* Разъяснение: как считается радар + что значит каждая ось */}
            <div className="mt-4 flex flex-col gap-2.5 border-t border-lines-hover pt-4">
              <p className="text-type-caption font-blender-book leading-4 text-text-secondary">
                Оси Бой · Агрессия · Добыча · Отряд считаются из твоего поведения на портале
                (какие разделы смотришь — те же сигналы, что определяют архетип), приведённого
                к шкале 0–100%. Выживание берётся из загруженного профиля ЧВК.
              </p>
              <dl className="flex flex-col gap-1.5">
                {RADAR_AXIS_LEGEND.map((a) => (
                  <div key={a.label} className="flex gap-2.5">
                    <dt className="w-20 shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-primary">
                      {a.label}
                    </dt>
                    <dd className="min-w-0 flex-1 text-type-caption font-blender-book leading-4 text-text-secondary">
                      {a.desc}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* XP-полоса тира (нижний якорь панели) */}
          <div className="border-t border-lines-hover pt-4">
            <XpNotchBar
              percent={signals.xpProgress}
              tierLabel={`XP · ${currentTier.label}`}
              nextLabel={nextTier ? `След. тир: ${nextTier.label}` : 'Максимальный тир'}
            />
          </div>

          {/* Пикер архетипа — оверлей «в том же фрейме» поверх панели прогрессии */}
          {pickerOpen && (
            <div className="absolute inset-0 z-20 overflow-y-auto">
              <ArchetypePicker onClose={() => setPickerOpen(false)} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
