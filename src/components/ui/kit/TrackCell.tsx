'use client';

// Канон-ячейка трекинга (эталон — ячейки документов Battlepass-трекера, грил V4DYA).
// Аутентичный слот EFT: рарити-фон + линейный блик + вертикальная заливка «собрано/нужно»
// + внутренняя тень + бейдж X/Y. Боль «куда девать +/−» решена без кнопок:
//   • Десктоп (тонкий указатель): ЛКМ +1, ПКМ −1.
//   • Мобайл (грубый указатель): невидимые тап-зоны — левая половина −1, правая +1.
// Зоны включаются только под `@media (pointer: coarse)`, поэтому на десктопе не мешают
// ЛКМ/ПКМ, а на телефоне дают убавление без контекстного меню (идея V4DYA).
import { useState, type ReactNode } from 'react';
import { Package } from 'lucide-react';

export interface TrackCellProps {
  /** URL иконки предмета (напр. itemIconUrl(id)). При ошибке — глиф-фолбэк. */
  iconSrc?: string;
  alt?: string;
  /** Собрано. */
  have: number;
  /** Нужно (цель). */
  need: number;
  /** Дельта набора: +1 / −1. Клампинг — на стороне вызывающего (стор). */
  onInc: (delta: number) => void;
  /** Размер ячейки. По умолчанию 56×56 как в БП. */
  sizeClass?: string;
  /** Класс рарити-фона под иконкой. По умолчанию — редкое (#4C2A55 @30%). */
  bgClass?: string;
  /** Инлайн-фон ячейки (реальный цвет предмета). Переопределяет bgClass. */
  bgColor?: string;
  /** Не заливать ячейку вертикально (прогресс показывает родитель — напр. фон строки рейла). */
  noFill?: boolean;
  /** Угловой слот (верх-лево): бейдж «+N» и т.п. Рисуется поверх. */
  topLeft?: ReactNode;
  /** Угловой слот (низ-лево): FiR-маркер и т.п. Рисуется поверх (не перекрывает бейдж X/Y справа). */
  bottomLeft?: ReactNode;
  /** Угловой слот (верх-право): КЛИКАБЕЛЬНЫЙ (ссылка на карточку и т.п.) — z-40 над слоем +/−. */
  topRight?: ReactNode;
  /** Статичный бейдж вместо трекинг-счётчика X/Y (display-режим — напр. выход крафта «×N»).
   *  Задан → ячейка показывает его вместо X/Y, прямой ввод числа отключён. */
  badge?: ReactNode;
  /** Прямой ввод общего числа: клик по бейджу X/Y → инпут, Enter коммитит onSetTotal
   *  (решает «×4500 кликов» — вводишь число, а не жмёшь). Клампинг до need — внутри. */
  onSetTotal?: (n: number) => void;
  /** Витринный режим: подсветить невидимые мобильные тап-зоны (−/+). */
  revealZones?: boolean;
}

const CELL_SHADOW = 'shadow-[inset_0_-2.33px_11.67px_5.83px_rgba(0,0,0,0.7)]';

export function TrackCell({
  iconSrc,
  alt = '',
  have,
  need,
  onInc,
  sizeClass = 'h-14 w-14',
  bgClass = 'bg-(--color-rarity-rare)/30',
  bgColor,
  noFill = false,
  topLeft,
  bottomLeft,
  topRight,
  badge,
  onSetTotal,
  revealZones = false,
}: TrackCellProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const commit = () => {
    onSetTotal?.(Math.max(0, Math.min(need, parseInt(draft, 10) || 0)));
    setEditing(false);
  };

  const clampedHave = Math.max(0, Math.min(have, need));
  const state: 'default' | 'tracked' | 'done' =
    clampedHave <= 0 ? 'default' : clampedHave >= need ? 'done' : 'tracked';
  const fillPct = state === 'tracked' ? Math.round((clampedHave / need) * 100) : state === 'done' ? 100 : 0;

  // «Собрано» = nvg-green (#689963) — канон-цвет успеха/убежища дизайн-системы, а не яркий лайм success.
  const fillCls = state === 'done' ? 'bg-nvg-green' : 'bg-tactical-amber';
  const badgeTxt = state === 'done' ? 'text-nvg-green' : state === 'tracked' ? 'text-tactical-amber' : 'text-text-primary';

  const inc = () => {
    if (clampedHave < need) onInc(1);
  };
  const dec = () => {
    if (clampedHave > 0) onInc(-1);
  };

  return (
    <div
      className={`relative shrink-0 select-none overflow-hidden rounded-sm border border-(--color-base) ${sizeClass}`}
    >
      {/* Рарити-фон (класс или инлайн реальный цвет предмета) + линейный блик */}
      <span
        aria-hidden
        className={`absolute inset-0 ${bgColor ? '' : bgClass}`}
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/6 to-transparent" />

      {/* Заливка снизу «собрано/нужно» (кроме noFill — там прогресс показывает родитель) */}
      {!noFill && fillPct > 0 && (
        <span
          aria-hidden
          className={`absolute inset-x-0 bottom-0 ${fillCls} transition-[height] duration-300`}
          style={{ height: `${fillPct}%` }}
        />
      )}

      {/* Иконка предмета (или глиф-фолбэк) */}
      {iconSrc && !imgFailed ? (
        <img
          src={iconSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain p-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
        />
      ) : (
        <Package
          aria-hidden
          strokeWidth={1.5}
          className="pointer-events-none absolute inset-0 z-10 m-auto h-1/2 w-1/2 text-text-muted"
        />
      )}

      {/* Внутренняя тень слота */}
      <span aria-hidden className={`pointer-events-none absolute inset-0 z-10 ${CELL_SHADOW}`} />

      {/* Бейдж: статичный display-бейдж (badge) переопределяет трекинг-счётчик X/Y. */}
      {badge != null ? (
        <span className="absolute bottom-0 right-0 z-20 rounded-tl-xs bg-(--color-darkbase)/90 px-1 py-0.5 font-blender-medium text-[10pt] leading-none text-text-primary">
          {badge}
        </span>
      ) : onSetTotal ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(String(clampedHave));
            setEditing(true);
          }}
          title="Клик — ввести число"
          className={`absolute bottom-0 right-0 z-40 cursor-text rounded-tl-xs bg-(--color-darkbase)/90 px-1 py-0.5 font-blender-medium text-[10pt] leading-none ${badgeTxt}`}
        >
          {clampedHave}/{need}
        </button>
      ) : (
        <span
          className={`absolute bottom-0 right-0 z-20 rounded-tl-xs bg-(--color-darkbase)/90 px-1 py-0.5 font-blender-medium text-[10pt] leading-none ${badgeTxt}`}
        >
          {clampedHave}/{need}
        </span>
      )}

      {/* Оверлей прямого ввода общего числа */}
      {editing && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-(--color-darkbase)/95 p-1.5">
          <input
            autoFocus
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="w-full rounded-xs border border-(--primary) bg-(--color-base) py-0.5 text-center text-base font-blender-medium tabular-nums text-text-primary focus:outline-none"
          />
        </div>
      )}

      {/* Угловой слот верх-лево: бейдж «+N». */}
      {topLeft && <span className="pointer-events-none absolute left-0 top-0 z-20">{topLeft}</span>}

      {/* Угловой слот низ-лево: FiR-маркер. */}
      {bottomLeft && <span className="pointer-events-none absolute bottom-0 left-0 z-20">{bottomLeft}</span>}

      {/* Угловой слот верх-право: кликабельный (z-40 — выше слоя +/−, чтобы ловил клик). */}
      {topRight && <span className="absolute right-0 top-0 z-40">{topRight}</span>}

      {/* Десктоп-слой: ЛКМ +1, ПКМ −1. Отключается на грубом указателе. */}
      <button
        type="button"
        aria-label={`${alt || 'Предмет'} — ЛКМ +1, ПКМ −1 (${clampedHave}/${need})`}
        title={`${alt || 'Предмет'} — ЛКМ +1 · ПКМ −1  (${clampedHave}/${need})`}
        onClick={(e) => {
          e.stopPropagation();
          inc();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dec();
        }}
        className="absolute inset-0 z-30 cursor-pointer transition-[filter] hover:brightness-110 [@media(pointer:coarse)]:pointer-events-none"
      />

      {/* Мобильные тап-зоны: левая −1, правая +1. Только на грубом указателе. */}
      <button
        type="button"
        aria-label="Убавить"
        onClick={(e) => {
          e.stopPropagation();
          dec();
        }}
        className={`pointer-events-none absolute inset-y-0 left-0 z-30 flex w-1/2 items-center justify-start pl-1 [@media(pointer:coarse)]:pointer-events-auto ${
          revealZones ? 'bg-danger/25' : ''
        }`}
      >
        {revealZones && <span className="font-blender-medium text-lg leading-none text-danger">−</span>}
      </button>
      <button
        type="button"
        aria-label="Прибавить"
        onClick={(e) => {
          e.stopPropagation();
          inc();
        }}
        className={`pointer-events-none absolute inset-y-0 right-0 z-30 flex w-1/2 items-center justify-end pr-1 [@media(pointer:coarse)]:pointer-events-auto ${
          revealZones ? 'bg-success/25' : ''
        }`}
      >
        {revealZones && <span className="font-blender-medium text-lg leading-none text-success">+</span>}
      </button>
    </div>
  );
}
