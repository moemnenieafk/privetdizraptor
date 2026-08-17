'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { usePmcStatsStore } from '@/store/usePmcStatsStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useManualProfileStore } from '@/store/useManualProfileStore';
import { savePlayerProfileAction } from '@/actions/player-profile';
import { buildSnapshot } from '@/lib/player-profile-sync';
import { resolveSkillLevel, resolveHideoutLevel } from '@/lib/tarkov/player-view-merge';
import { SKILL_ICONS, SKILL_CAT_ORDER, SKILL_RU, SKILL_CATALOG } from './skill-icons';
import { HIDEOUT_STATIONS } from '@/data/hideout-catalog';
import { TRADERS } from '@/data/traders';
import { TRADER_COLORS } from '@/data/traderColors';

// Трейдеры с уровнем лояльности (совпадает с usePlayerStore.defaultTraderLevels — их читает весь сайт).
const TRADER_SLUGS = ['prapor', 'therapist', 'skier', 'peacekeeper', 'mechanic', 'ragman', 'jaeger', 'fence', 'ref'] as const;
const SKILL_MAX = 51; // потолок навыка (elite)
const TRADER_MAX = 4; // лояльность 1..4
const SAVE_DEBOUNCE_MS = 700;

/** Микро-заголовок группы с линией (§ rule-micro-labels). */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
        {children}
      </span>
      <div className="h-px flex-1 bg-lines-hover" />
    </div>
  );
}

/** Степпер уровня: [− | число (редактируемое) | +], клампится [min..max]. */
function LevelStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Убавить"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className="flex size-6 items-center justify-center rounded-xs border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:border-tactical-amber hover:text-tactical-amber disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Minus className="size-3" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number.parseInt(e.target.value, 10) || 0))}
        className="w-9 rounded-xs border border-lines-hover bg-(--color-darkbase) py-0.5 text-center font-blender-medium text-xs text-text-primary tabular-nums outline-none focus:border-tactical-amber [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Прибавить"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className="flex size-6 items-center justify-center rounded-xs border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:border-tactical-amber hover:text-tactical-amber disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}

/** Строка редактора: слева иконка+имя, справа степпер. */
function EditRow({
  icon,
  name,
  accent,
  value,
  min,
  max,
  onChange,
}: {
  icon: React.ReactNode;
  name: string;
  accent?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-(--color-darkbase) px-2.5 py-1.5">
      {icon}
      <span
        className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-primary"
        style={accent ? { color: accent } : undefined}
      >
        {name}
      </span>
      <LevelStepper value={value} min={min} max={max} onChange={onChange} />
    </div>
  );
}

/** Сворачиваемая под-группа (Навыки-категория / Убежище / Трейдеры). */
function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex w-full items-center gap-3 text-left"
      >
        <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
          {title}
        </span>
        <div className="h-px flex-1 bg-lines-hover" />
        <ChevronDown
          className={`size-3.5 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{children}</div>}
    </div>
  );
}

/**
 * Ручной редактор прогресса (Слой C, спека player-profile-persistence). Полный, группами: навыки по
 * 4 категориям + станции убежища + трейдеры. Пишет ручные оверрайды (last-write-wins поверх
 * загруженного профиля): навыки/убежище → useManualProfileStore; трейдеры → write-through в
 * usePlayerStore.traderLevels (их читает весь сайт) + зеркало в manual для снапшота.
 *
 * Персистенция: залогинен → дебаунс-save снапшота на сервер; аноним → localStorage (persist сторов) +
 * призыв войти. Секция свёрнута по умолчанию (не шумит в досье, §8).
 */
export function DossierManualEditor({ isAuthed = false }: { isAuthed?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [open, setOpen] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const view = usePmcStatsStore((s) => s.view);
  const manualSkills = useManualProfileStore((s) => s.skills);
  const manualHideout = useManualProfileStore((s) => s.hideout);
  const setSkill = useManualProfileStore((s) => s.setSkill);
  const setHideout = useManualProfileStore((s) => s.setHideout);
  const setTrader = useManualProfileStore((s) => s.setTrader);
  const manualHydrated = useManualProfileStore((s) => s._hasHydrated);

  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const traderLevels = usePlayerStore(
    (s) => (s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0])?.traderLevels,
  );
  const updateProfile = usePlayerStore((s) => s.updateProfile);

  // Дебаунс серверной записи: правки летят пачкой, шлём один снапшот после паузы.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const scheduleSave = () => {
    if (!isAuthed) return; // аноним — только localStorage (persist сторов сам сохранил)
    setSaveState('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const source = usePmcStatsStore.getState().view ? 'mixed' : 'manual';
      const res = await savePlayerProfileAction(buildSnapshot(source));
      setSaveState(res.ok ? 'saved' : 'idle');
    }, SAVE_DEBOUNCE_MS);
  };

  const onSkill = (id: string, level: number) => { setSkill(id, level); scheduleSave(); };
  const onHideout = (type: number, level: number) => { setHideout(type, level); scheduleSave(); };
  const onTrader = (slug: string, level: number) => {
    // Write-through в traderLevels (канон сайта) + зеркало в manual (для снапшота).
    if (traderLevels) updateProfile(activeProfileId, { traderLevels: { ...traderLevels, [slug]: level } });
    setTrader(slug, level);
    scheduleSave();
  };

  if (!mounted || !manualHydrated) return null;

  return (
    <section className="rounded-lg bg-(--color-darkbase)">
      {/* Заголовок секции — раскрывает редактор */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 rounded-lg p-4 text-left transition-colors hover:bg-card-menu"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-(--color-darkbase) text-tactical-amber">
          <SlidersHorizontal className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-blender-medium uppercase tracking-widest text-text-primary">
            Ручной ввод прогресса
          </h3>
          <p className="mt-0.5 font-blender-book text-xs leading-tight text-text-secondary">
            Заполни то, чего нет в загруженном профиле — уровни убежища, навыков и трейдеров. Ручной
            ввод перекрывает данные из JSON.
          </p>
        </div>
        <ChevronDown
          className={`mt-1 size-4 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-7 px-4 pb-5">
          {/* Статус сохранения */}
          <p className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            {!isAuthed
              ? 'Изменения сохраняются в этом браузере. Войди, чтобы синхронизировать между устройствами.'
              : saveState === 'saving'
                ? 'Сохранение…'
                : saveState === 'saved'
                  ? 'Сохранено в профиль'
                  : 'Изменения сохраняются автоматически'}
          </p>

          {/* ── НАВЫКИ (по категориям) ─────────────────────────────── */}
          <div>
            <GroupLabel>Навыки</GroupLabel>
            <div className="flex flex-col gap-4">
              {SKILL_CAT_ORDER.map(({ cat, label }, i) => (
                <Collapsible key={cat} title={label} defaultOpen={i === 0}>
                  {SKILL_CATALOG[cat].map((id) => {
                    const icon = SKILL_ICONS[id];
                    return (
                      <EditRow
                        key={id}
                        icon={
                          icon ? (
                            <img src={icon.src} alt="" aria-hidden className="size-9 shrink-0 object-contain" />
                          ) : (
                            <span className="size-9 shrink-0" />
                          )
                        }
                        name={SKILL_RU[id] ?? id}
                        value={resolveSkillLevel(view, manualSkills, id)}
                        min={0}
                        max={SKILL_MAX}
                        onChange={(v) => onSkill(id, v)}
                      />
                    );
                  })}
                </Collapsible>
              ))}
            </div>
          </div>

          {/* ── УБЕЖИЩЕ ─────────────────────────────────────────────── */}
          <Collapsible title="Убежище">
            {HIDEOUT_STATIONS.map((st) => (
              <EditRow
                key={st.type}
                icon={<span className="size-2 shrink-0 rounded-full bg-lines-hover" />}
                name={st.name}
                value={resolveHideoutLevel(view, manualHideout, st.type)}
                min={0}
                max={st.maxLevel}
                onChange={(v) => onHideout(st.type, v)}
              />
            ))}
          </Collapsible>

          {/* ── ТРЕЙДЕРЫ ────────────────────────────────────────────── */}
          <Collapsible title="Трейдеры">
            {TRADER_SLUGS.map((slug) => {
              const t = TRADERS.find((x) => x.slug === slug);
              const accent = TRADER_COLORS[slug];
              return (
                <EditRow
                  key={slug}
                  icon={
                    t ? (
                      <img src={t.image} alt="" aria-hidden className="size-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="size-9 shrink-0" />
                    )
                  }
                  name={t?.nameRu ?? slug}
                  accent={accent}
                  value={traderLevels?.[slug] ?? 1}
                  min={1}
                  max={TRADER_MAX}
                  onChange={(v) => onTrader(slug, v)}
                />
              );
            })}
          </Collapsible>
        </div>
      )}
    </section>
  );
}
