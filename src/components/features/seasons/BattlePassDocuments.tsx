'use client';

// Правая колонка трекера — рейл «ТРЕКЕР ДОКУМЕНТАЦИИ TERRAGROUP». Сверху 3 чипа-сводки
// (получено наград · найдено в рейде · осталось собрать), затем 8 строк-типов документа:
// ячейка-редкость с заливкой набора, аккордеон «Где найти документы?» (карты из doc.maps),
// остаток `needed−spent` и счётчик −/+. Внизу — дневные лимиты (монета по режиму) и сноски.
// Активная (раскрытая) строка подсвечивается nvg-green (грилл V4DYA 2026-08-14).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Info, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  BP_DAILY_LIMITS,
  BP_DOC_ORDER,
  BP_LIMIT_BY_MODE,
  BP_SECRET_DATA_NOTE,
  type BpDocType,
} from '@/data/eft-battlepass';
import { docRows, etaDays, type TrackerSummary } from '@/lib/battlepass';
import { itemIconUrl } from '@/lib/item-icon';
import { FillMedia } from '@/components/ui/FillMedia';
import { useBattlePassStore } from '@/store/useBattlePassStore';
import { BP_MODE_META } from './battlepassVisual';

const MASK = 'mask-contain mask-center mask-no-repeat';
const MICRO = 'font-blender-medium text-type-micro uppercase tracking-widest';
const DAY_MS = 24 * 60 * 60 * 1000;
// Фон плитки документа — единый рарити «редкое» #4C2A55 @30% (grill V4DYA).
const DOC_BG = 'color-mix(in srgb, var(--color-rarity-rare) 30%, transparent)';

// RU-имя карты (doc.maps) → slug маршрута /eft/maps/<slug> (grill V4DYA: «где искать» → карта).
// ⏳ Маркеры-категории документов на карте ждут датасет спавнов доков (Ф2) — пока ведём на карту.
const MAP_SLUG: Record<string, string> = {
  'Таможня': 'customs',
  'Улицы Таркова': 'streets-of-tarkov',
  'Развязка': 'interchange',
  'Резерв': 'reserve',
  'Маяк': 'lighthouse',
  'Ледокол': 'icebreaker',
  'Завод': 'factory',
  'Лабиринт': 'labyrinth',
  'Берег': 'shoreline',
  'Лес': 'woods',
  'Эпицентр': 'ground-zero',
  'Лаборатория': 'the-lab',
};

interface Props {
  slug: string;
  summary: TrackerSummary;
  collected: Partial<Record<BpDocType, number>>;
  onInc: (type: BpDocType, delta: number) => void;
  onReset: () => void;
  confirmReset: boolean;
}

function StatChip({
  label,
  value,
  iconClass,
  iconTint,
  textClass,
  sub,
}: {
  label: string;
  value: string;
  iconClass: string;
  iconTint: string;
  /** Если задан — красит и подпись, и число в цвет иконки (grill V4DYA: «Получено наград»). */
  textClass?: string;
  /** Доп. строка под числом (напр. «M использовано» под «Найдено в рейде»). */
  sub?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className={`${MICRO} ${textClass ?? 'text-text-muted'}`}>{label}</span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className={`${iconClass} h-4 w-4 ${iconTint} ${MASK}`} />
        <span className={`font-blender-medium text-base ${textClass ?? 'text-text-primary'}`}>{value}</span>
      </span>
      {sub && <span className={`${MICRO} text-text-muted`}>{sub}</span>}
    </div>
  );
}

function DocRailRow({
  itemId,
  docType,
  name,
  maps,
  needed,
  found,
  collected,
  expanded,
  onToggleExpand,
  onInc,
}: {
  itemId: string;
  docType: BpDocType;
  name: string;
  maps: readonly string[];
  needed: number;
  found: number;
  collected: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onInc: (delta: number) => void;
}) {
  const remaining = Math.max(0, needed - found);
  const pct = needed > 0 ? Math.min(100, Math.round((found / needed) * 100)) : 0;
  const done = needed > 0 && found >= needed;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-sm bg-card-menu">
      {/* Горизонтальный прогресс-бар по фону строки (grill V4DYA): собрано/нужно, nvg-green */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-nvg-green/30 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center gap-3 p-2">
        <FillMedia
          imageSrc={itemIconUrl(itemId)}
          alt={name}
          sizeClass="h-14 w-14"
          bgColor={DOC_BG}
          pct={0}
          done={done}
          onTap={() => onInc(1)}
          tapTitle={`${name} — клик: +1`}
          imgLoading="lazy"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 font-blender-medium text-xs uppercase leading-tight tracking-wide text-text-primary" title={name}>
            {name}
          </span>
          {/* Разбивка запаса: найдено (collected+spent) · использовано на награды · свободно в наличии.
              «Свободно» = не потраченные документы, которыми можно закрывать награды слева (V4DYA 2026-08-15). */}
          <span className="flex flex-wrap items-center gap-x-2 font-blender-medium text-type-micro uppercase tracking-wide">
            <span className="text-nvg-green">найдено {found}</span>
            <span className="text-text-muted">исп. {found - collected}</span>
            <span className={collected > 0 ? 'text-text-primary' : 'text-text-muted'}>своб. {collected}</span>
          </span>
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className={`self-start ${MICRO} transition-colors ${expanded ? 'text-(--primary)' : 'text-text-muted hover:text-(--primary)'}`}
          >
            {expanded ? 'Скрыть подробности' : 'Где найти документы?'}
          </button>
        </div>

        <span
          className={`font-blender-medium text-xl ${done ? 'text-nvg-green' : 'text-text-primary'}`}
          title="Осталось налутать до полного пропуска"
        >
          {remaining}
        </span>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            aria-label="Прибавить"
            onClick={() => onInc(1)}
            className="flex h-6 w-6 items-center justify-center rounded-xs bg-lines-hover text-text-muted transition-colors hover:text-(--primary)"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Убавить"
            onClick={() => onInc(-1)}
            disabled={collected <= 0}
            className="flex h-6 w-6 items-center justify-center rounded-xs bg-lines-hover text-text-muted transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="relative flex flex-wrap items-center gap-1.5 border-t border-nvg-green/20 px-2 py-2">
          <span className={`${MICRO} text-text-muted`}>Где искать:</span>
          {maps.map((m) => {
            const slug = MAP_SLUG[m];
            const base = 'rounded-xs border border-lines-hover bg-(--color-darkbase) px-1.5 py-px font-blender-medium text-type-micro uppercase tracking-wide transition-colors';
            return slug ? (
              <Link key={m} href={`/eft/maps/${slug}?doc=${docType}`} className={`${base} text-text-secondary hover:border-(--primary) hover:text-(--primary)`}>
                {m}
              </Link>
            ) : (
              <span key={m} className={`${base} text-text-secondary`}>
                {m}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Блок «Дневной лимит» — 3 кнопки-режима (Season/PvP/PvE) + трекинг набора за 24ч (грилл V4DYA 2026-08-15).
 * Выбор режима (radio-снимаемый) включает трекинг и задаёт cap 30/20/15. Любой +1 набора документа
 * растит дневной счётчик (см. onDocCollect в BattlePassTracker). При достижении cap — инлайн-вопрос
 * «Продолжить?»: «Да» → красный «исчерпан»-баннер с обратным таймером до конца окна; набор не блокируется.
 * Всё вычисляется от текущего cap: смена режима на больший перевзводит предупреждение (Q7).
 */
function DailyModeBlock({ slug, remaining }: { slug: string; remaining: number }) {
  const daily = useBattlePassStore((s) => s.daily[slug]);
  const setDailyMode = useBattlePassStore((s) => s.setDailyMode);
  const ackDaily = useBattlePassStore((s) => s.ackDaily);
  const rolloverDaily = useBattlePassStore((s) => s.rolloverDaily);

  const mode = daily?.mode ?? null;
  const count = daily?.count ?? 0;
  const windowStart = daily?.windowStart ?? null;
  const ackCap = daily?.ackCap ?? null;
  const continued = daily?.continued ?? false;

  // Тикаем раз в секунду, пока открыто окно — для обратного таймера «исчерпан»-баннера.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (windowStart == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [windowStart]);

  const cap = mode ? BP_LIMIT_BY_MODE[mode] : null;
  const msLeft = windowStart != null ? Math.max(0, windowStart + DAY_MS - now) : 0;
  const expired = windowStart != null && msLeft <= 0;

  // Истекло окно 24ч → сбрасываем счётчик/окно/ответ (режим остаётся, Q5).
  useEffect(() => {
    if (expired) rolloverDaily(slug);
  }, [expired, slug, rolloverDaily]);

  const overLimit = cap != null && count >= cap;
  const showPrompt = overLimit && ackCap !== cap;
  const exhausted = overLimit && continued && ackCap === cap;

  const totalSec = Math.floor(msLeft / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  return (
    <div className="flex flex-col gap-2 pt-2">
      {/* Шапка-статус: приоритет вопрос → «исчерпан» → приглашение выбрать режим. */}
      {showPrompt && cap != null ? (
        <div className="flex flex-col gap-2 rounded-sm border border-tactical-amber/40 bg-tactical-amber/10 p-2.5">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tactical-amber" aria-hidden />
            <span className="font-blender-book text-type-caption leading-snug text-text-primary">
              Возможно, у тебя дневной лимит сбора документов. Продолжить?
            </span>
          </span>
          <span className="flex gap-2 pl-6">
            <button
              type="button"
              onClick={() => ackDaily(slug, cap, true)}
              className={`rounded bg-tactical-amber px-3 py-1 ${MICRO} text-(--color-darkbase) transition-[filter] hover:brightness-110`}
            >
              Да
            </button>
            <button
              type="button"
              onClick={() => ackDaily(slug, cap, false)}
              className={`rounded border border-lines-hover px-3 py-1 ${MICRO} text-text-secondary transition-colors hover:text-text-primary`}
            >
              Нет
            </button>
          </span>
        </div>
      ) : exhausted ? (
        <div className="flex items-center gap-2.5 rounded-sm border border-danger/50 bg-danger/10 p-2.5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={`${MICRO} text-danger`}>Ваш дневной лимит исчерпан!</span>
            <span className="font-blender-book text-type-caption text-text-secondary">Возобновляется через</span>
          </span>
          <span className="font-blender-medium text-2xl leading-none tabular-nums text-danger">
            {hh}:{mm}:{ss}
          </span>
        </div>
      ) : (
        <p className="flex items-start gap-2 font-blender-book text-type-caption leading-relaxed text-text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Выбери режим, в который играешь, чтобы включить трекинг дневного лимита сбора документов.
        </p>
      )}

      {/* 3 кнопки-режима */}
      {BP_DAILY_LIMITS.map((lim) => {
        const meta = BP_MODE_META[lim.key];
        const selected = mode === lim.key;
        const dimmed = mode != null && !selected;
        const tint = selected ? meta.colorVar : 'var(--color-text-secondary)';
        const selDays = etaDays(remaining, lim.limit);

        return (
          <button
            key={lim.key}
            type="button"
            onClick={() => setDailyMode(slug, lim.key)}
            aria-pressed={selected}
            className={`relative flex items-center justify-between gap-3 overflow-hidden rounded-sm p-2 text-left transition-[opacity,background-color] ${
              selected ? '' : 'bg-card-menu'
            } ${dimmed ? 'opacity-40 hover:opacity-70' : ''}`}
            style={selected ? { backgroundColor: `color-mix(in srgb, ${meta.colorVar} 10%, transparent)` } : undefined}
          >
            {selected && (
              <span aria-hidden className="absolute inset-y-0 left-0 w-0.5" style={{ backgroundColor: meta.colorVar }} />
            )}

            <span className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden className={`${meta.iconClass} h-8 w-8 shrink-0 ${MASK}`} style={{ backgroundColor: tint }} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={`${MICRO} truncate`} style={{ color: tint }}>
                  {selected ? `Я ИГРАЮ В ${meta.label}` : meta.label}
                </span>
                <span className={`${MICRO} text-text-muted`}>Дневной лимит</span>
                {selected && (
                  <span className="font-blender-medium text-type-caption text-tactical-amber">
                    {selDays > 0 ? `≈ ${selDays} дн. до финала` : 'всё собрано'}
                  </span>
                )}
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-end">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className={`icon-eft-battlepass-docs-coin h-6 w-6 ${MASK}`} style={{ backgroundColor: tint }} />
                {/* Собрано сегодня / лимит режима — N/30, N/20, N/15 (счётчик общий, cap свой) */}
                <span className="flex items-baseline gap-0.5">
                  <span
                    className="font-blender-medium text-3xl leading-none"
                    style={{ color: count >= lim.limit ? 'var(--color-danger)' : tint }}
                  >
                    {count}
                  </span>
                  <span className="font-blender-medium text-lg leading-none text-text-muted">/{lim.limit}</span>
                </span>
              </span>
              <span className={`${MICRO} text-text-muted`}>док. / день</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function BattlePassDocuments({ slug, summary, collected, onInc, onReset, confirmReset }: Props) {
  const [openType, setOpenType] = useState<BpDocType | null>(null);
  const rows = docRows(summary);
  // «Найдено» = документы в руках (collected) + потраченные на полученные награды (spent):
  // клик «Получено» растит spent → «найдено в рейде» растёт и строки-типы заполняются (grill V4DYA).
  const foundOf = (t: BpDocType) => (collected[t] ?? 0) + summary.spent[t];
  const foundTotal = BP_DOC_ORDER.reduce((n, t) => n + foundOf(t), 0);
  const remainingToFindTotal = Math.max(0, summary.neededTotal - foundTotal);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Шапка рейла ── */}
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Трекер документации TERRAGROUP
        </h2>
        <span className="font-blender-medium text-sm text-text-muted">{summary.neededTotal}</span>
        <button
          type="button"
          onClick={onReset}
          title="Сбросить прогресс сезона"
          className={`flex h-7 items-center gap-1 rounded-xs border px-2 ${MICRO} transition-colors ${
            confirmReset ? 'border-danger text-danger' : 'border-lines-hover text-text-muted hover:border-danger hover:text-danger'
          }`}
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          {confirmReset ? 'Точно?' : ''}
        </button>
      </div>

      {/* ── 3 чипа-сводки ── */}
      <div className="flex items-start gap-3">
        <StatChip label="Получено наград" value={`${summary.rewardsClaimed} / ${summary.rewardsTotal}`} iconClass="icon-eft-reward" iconTint="bg-season-01" textClass="text-season-01" />
        <StatChip label="Найдено в рейде" value={String(foundTotal)} iconClass="icon-eft-battlepass-docs-coin" iconTint="bg-nvg-green" textClass="text-nvg-green" sub={`${summary.spentTotal} использовано`} />
        <StatChip label="Осталось собрать" value={String(remainingToFindTotal)} iconClass="icon-eft-battlepass-docs-coin" iconTint="bg-tactical-amber" textClass="text-tactical-amber" />
      </div>

      {/* ── Строки-типы документов ── */}
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <DocRailRow
            key={r.doc.type}
            itemId={r.doc.itemId}
            docType={r.doc.type}
            name={r.doc.name}
            maps={r.doc.maps}
            needed={r.needed}
            found={foundOf(r.doc.type)}
            collected={collected[r.doc.type] ?? 0}
            expanded={openType === r.doc.type}
            onToggleExpand={() => setOpenType((cur) => (cur === r.doc.type ? null : r.doc.type))}
            onInc={(d) => onInc(r.doc.type, d)}
          />
        ))}
      </div>

      {/* ── Дневной лимит: кнопки-режимы + трекинг ── */}
      <DailyModeBlock slug={slug} remaining={remainingToFindTotal} />

      {/* ── Сноски ── */}
      <div className="flex flex-col gap-2 pt-2">
        <p className="font-blender-book text-type-caption leading-relaxed text-text-muted">
          Лимит-сутки у каждого режима свой и стартуют с первого поднятого в рейде документа. Оценка рейдо-дней — по остатку ({remainingToFindTotal} док.) при полном использовании лимита.
        </p>
        <p className="font-blender-book text-type-caption leading-relaxed text-text-muted">{BP_SECRET_DATA_NOTE}</p>
      </div>
    </div>
  );
}
