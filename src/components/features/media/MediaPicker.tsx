'use client';

// Пикер изображения для форм редактора. Итер.3 (Figma node 2905-1204): не полноэкранная модалка,
// а БОКОВАЯ панель-оверлей СПРАВА от карточки маркера. Рендерится порталом в body, чтобы выйти
// из `transform` overlay'а карточки (иначе fixed зажимался её шириной и панель была узкой).
// Позиция считается от прямоугольника карточки (anchorRef): справа + gap, при нехватке места — слева.
import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Images } from 'lucide-react';
import { MediaLibrary } from './MediaLibrary';
import { SheetCloseButton } from '@/components/ui/SheetCloseButton';

interface Props {
  onPick: (url: string) => void;
  /** Батч-выбор (режим «Выбрать») — добавить несколько картинок разом. */
  onPickMany?: (urls: string[]) => void;
  onClose: () => void;
  /** Якорь — корень карточки маркера. Панель встаёт справа от него (или слева, если не влезает). */
  anchorRef?: RefObject<HTMLElement | null>;
}

const PANEL_W = 348; // w-87 — ширина панели из Figma
const GAP = 14; // зазор между карточкой и панелью (Figma)
const MARGIN = 8; // отступ от краёв вьюпорта

export function MediaPicker({ onPick, onPickMany, onClose, anchorRef }: Props) {
  // Высота панели = высоте окна карточки-визарда (ask V4DYA): height берём из прямоугольника якоря.
  const [pos, setPos] = useState<{ top: number; left: number; height: number | null } | null>(null);

  useLayoutEffect(() => {
    const el = anchorRef?.current ?? null;
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const a = el?.getBoundingClientRect();
      if (!a) {
        // фолбэк без якоря — по центру, высота по контенту
        setPos({ top: Math.max(MARGIN, vh / 2 - 220), left: Math.max(MARGIN, vw / 2 - PANEL_W / 2), height: null });
        return;
      }
      let left = a.right + GAP; // справа от карточки
      if (left + PANEL_W > vw - MARGIN) left = a.left - GAP - PANEL_W; // не влезло справа → слева
      if (left < MARGIN) left = Math.max(MARGIN, vw - PANEL_W - MARGIN); // и слева не влезло → к правому краю
      const top = Math.min(Math.max(MARGIN, a.top), vh - 140);
      setPos({ top, left, height: a.height }); // высота = высоте карточки
    };
    compute();
    window.addEventListener('resize', compute);
    // Карточка меняет высоту по шагам визарда — следим и подгоняем панель.
    const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : null;
    if (el && ro) ro.observe(el);
    return () => {
      window.removeEventListener('resize', compute);
      ro?.disconnect();
    };
  }, [anchorRef]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Прозрачный слой-ловушка: клик мимо панели закрывает пикер. Без затемнения — панель стоит
          рядом с карточкой (как в макете), не перекрывает весь экран визуально. */}
      <div className="fixed inset-0 z-[1100]" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={pos ? { top: pos.top, left: pos.left, height: pos.height ?? undefined } : { visibility: 'hidden' }}
        className="scrollbar-hidden fixed z-[1101] flex max-h-[calc(100vh-1rem)] w-87 flex-col overflow-y-auto rounded-sm border border-lines-hover bg-(--color-base) p-3.5"
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Images className="h-4 w-4 shrink-0 text-text-secondary" />
            <h2 className="min-w-0 truncate font-blender-medium text-sm uppercase tracking-widest text-text-primary">
              Медиа-библиотека
            </h2>
          </span>
          <SheetCloseButton onClick={onClose} />
        </header>

        <MediaLibrary
          onPick={(url) => {
            onPick(url);
            onClose();
          }}
          onPickMany={
            onPickMany
              ? (urls) => {
                  onPickMany(urls);
                  onClose();
                }
              : undefined
          }
        />
      </div>
    </>,
    document.body,
  );
}
