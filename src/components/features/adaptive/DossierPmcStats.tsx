'use client';

import { useEffect, useState } from 'react';
import { usePmcStatsStore } from '@/store/usePmcStatsStore';
import { useManualProfileStore } from '@/store/useManualProfileStore';
import { effectiveSkills } from '@/lib/tarkov/player-view-merge';
import { SKILL_ICONS, SKILL_CAT_ORDER, SKILL_RU, type SkillCat } from './skill-icons';
import type { PlayerSkillView, PlayerMasteringView, RaidStatLine } from '@/types/eft-player';

const MASTERY_PREVIEW = 12; // топ-N мастерства до разворота (§ спека)

function fmt(n: number): string {
  return n.toLocaleString('ru-RU');
}

/** Микро-заголовок блока с линией (§ rule-micro-labels + паттерн AdaptiveHubClient). */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
        {children}
      </span>
      <div className="h-px flex-1 bg-lines-hover" />
    </div>
  );
}

/** Карточка навыка: иконка + RU-имя + уровень (3-кол сетка). */
function SkillCard({ skill }: { skill: PlayerSkillView }) {
  const icon = SKILL_ICONS[skill.id];
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-(--color-darkbase) px-3 py-2">
      {icon && (
        <img src={icon.src} alt="" aria-hidden className="size-14 shrink-0 object-contain" />
      )}
      <span className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-primary">
        {SKILL_RU[skill.id] ?? skill.id}
      </span>
      <span className="shrink-0 font-blender-medium text-xs text-(--primary) tabular-nums">{skill.level}</span>
    </div>
  );
}

/** Строка «прочего» навыка без иконки: имя + уровень. */
function OtherSkillRow({ skill }: { skill: PlayerSkillView }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-(--color-darkbase) px-3 py-1.5">
      <span className="min-w-0 flex-1 truncate font-blender-book text-sm text-text-secondary">
        {SKILL_RU[skill.id] ?? skill.id}
      </span>
      <span className="ml-2 shrink-0 font-blender-medium text-xs text-(--primary) tabular-nums">{skill.level}</span>
    </div>
  );
}

function SkillsSection({ skills }: { skills: PlayerSkillView[] }) {
  if (skills.length === 0) return null;

  // Разложить навыки по категориям иконочного маппинга; несопоставленные → «Прочие».
  const byCat: Record<SkillCat, PlayerSkillView[]> = { physical: [], mental: [], practical: [], combat: [] };
  const other: PlayerSkillView[] = [];
  for (const s of skills) {
    const icon = SKILL_ICONS[s.id];
    if (icon) byCat[icon.cat].push(s);
    else other.push(s);
  }

  return (
    <section>
      <SectionLabel>
        Навыки <span className="text-text-secondary">({skills.length})</span>
      </SectionLabel>
      <div className="flex flex-col gap-5">
        {SKILL_CAT_ORDER.map(({ cat, label }) => {
          const items = byCat[cat];
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <p className="mb-2 text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
                {label}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {items.map((s) => (
                  <SkillCard key={s.id} skill={s} />
                ))}
              </div>
            </div>
          );
        })}

        {other.length > 0 && (
          <div>
            <p className="mb-2 text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
              Прочие навыки
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {other.map((s) => (
                <OtherSkillRow key={s.id} skill={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MasterySection({ mastering }: { mastering: PlayerMasteringView[] }) {
  const [expanded, setExpanded] = useState(false);
  if (mastering.length === 0) return null;

  const shown = expanded ? mastering : mastering.slice(0, MASTERY_PREVIEW);
  const rest = mastering.length - MASTERY_PREVIEW;

  return (
    <section>
      <SectionLabel>
        Мастерство оружия <span className="text-text-secondary">({mastering.length})</span>
      </SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-md bg-(--color-darkbase) px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate font-blender-book text-sm text-text-primary">{m.id}</span>
            <span className="ml-2 shrink-0 font-blender-medium text-xs text-text-secondary tabular-nums">
              {fmt(m.progress)}
            </span>
          </div>
        ))}
      </div>
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-type-micro font-blender-medium uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80"
        >
          {expanded ? 'Свернуть' : `Показать все (${mastering.length})`}
        </button>
      )}
    </section>
  );
}

const RAID_COLS: ReadonlyArray<{ key: keyof RaidStatLine; label: string }> = [
  { key: 'raids', label: 'Рейды' },
  { key: 'survived', label: 'Выжил' },
  { key: 'transit', label: 'Транзит' },
  { key: 'kia', label: 'Погиб' },
  { key: 'kills', label: 'Убийства' },
  { key: 'killsPmc', label: 'ЧВК' },
  { key: 'streak', label: 'Серия' },
];

/** Таблица рейдов по сторонам (PMC/Scav/Всего) — паттерн RaidTable из ProfileStats. */
function RaidsSection({ rows }: { rows: RaidStatLine[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <SectionLabel>Рейды</SectionLabel>
      <div className="overflow-x-auto border border-lines-hover">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-darkbase">
              <th className="px-4 py-2 text-left text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                Сторона
              </th>
              {RAID_COLS.map((c) => (
                <th
                  key={c.key}
                  className="px-4 py-2 text-right text-type-micro font-blender-medium uppercase tracking-widest text-text-muted"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.side} className="border-t border-lines-hover">
                <td className="px-4 py-2 text-left text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
                  {r.side === 'Total' ? 'Всего' : r.side}
                </td>
                {RAID_COLS.map((c) => (
                  <td key={c.key} className="px-4 py-2 text-right font-blender-medium text-xs text-text-primary tabular-nums">
                    {fmt(r[c.key] as number)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Секция детальной статистики ЧВК в досье. Читает рич-стату из usePmcStatsStore.
 * Профиль-гейт (§ спека): view==null → рендерит null (секции нет, пока не загружен профиль).
 * Всё, что рисуем — навыки / мастерство / рейды — данных нет → подсекция скрыта (§4.5).
 */
export function DossierPmcStats() {
  // localStorage-стор: до монтирования view недостоверен → не рендерим (избегаем SSR-скачка).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const view = usePmcStatsStore((s) => s.view);
  const manualSkills = useManualProfileStore((s) => s.skills);

  // Навыки — эффективные (загруженные, перекрытые ручным вводом Слоя C, last-write-wins).
  const skills = effectiveSkills(view, manualSkills);

  // Секции нет, только если ни профиля, ни ручных навыков.
  if (!mounted || (!view && skills.length === 0)) return null;

  return (
    <section className="flex flex-col gap-8">
      <SkillsSection skills={skills} />
      {view && <MasterySection mastering={view.mastering} />}
      {view && <RaidsSection rows={view.raidStats} />}
    </section>
  );
}
