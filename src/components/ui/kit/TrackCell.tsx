'use client';

// Канон-ячейка трекинга (эталон — ячейки документов Battlepass-трекера, грил V4DYA).
// Аутентичный слот EFT: рарити-фон + линейный блик + вертикальная заливка «собрано/нужно»
// + внутренняя тень + бейдж X/Y. Боль «куда девать +/−» решена без кнопок:
//   • Десктоп (тонкий указатель): ЛКМ +1, ПКМ −1.
//   • Мобайл (грубый указатель): невидимые тап-зоны — левая половина −1, правая +1.
// Зоны включаются только под `@media (pointer: coarse)`, поэтому на десктопе не мешают
// ЛКМ/ПКМ, а на телефоне дают убавление без контекстного меню (идея V4DYA).
import { useState } from 'react';
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
  revealZones = false,
}: TrackCellProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const clampedHave = Math.max(0, Math.min(have, need));
  const state: 'default' | 'tracked' | 'done' =
    clampedHave <= 0 ? 'default' : clampedHave >= need ? 'done' : 'tracked';
  const fillPct = state === 'tracked' ? Math.round((clampedHave / need) * 100) : state === 'done' ? 100 : 0;

  const fillCls = state === 'done' ? 'bg-success' : 'bg-tactical-amber';
  const badgeTxt = state === 'done' ? 'text-success' : state === 'tracked' ? 'text-tactical-amber' : 'text-text-primary';

  const inc = () => {
    if (clampedHave < need) onInc(1);
  };
  const dec = () => {
    if (clampedHave > 0) onInc(-1);
  };

  return (
    <div
      className={`relative shrink-0 select-none overflow-hidden rounded-xs border border-(--color-darkbase) ${sizeClass}`}
    >
      {/* Рарити-фон + линейный блик */}
      <span aria-hidden className={`absolute inset-0 ${bgClass}`} />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/6 to-transparent" />

      {/* Заливка снизу «собрано/нужно» */}
      {fillPct > 0 && (
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

      {/* Бейдж X/Y */}
      <span
        className={`absolute bottom-0 right-0 z-20 rounded-tl-xs bg-(--color-darkbase)/90 px-1 py-0.5 font-blender-medium text-[10pt] leading-none ${badgeTxt}`}
      >
        {clampedHave}/{need}
      </span>

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
