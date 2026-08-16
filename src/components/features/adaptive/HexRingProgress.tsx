'use client';

import { useEffect, useState } from 'react';

const HEX_RING_MASK = 'url(/icons/eft/04-progression/hex-ring.svg)';

/** Общие свойства маски-формы гекс-кольца (сегментированный тик-путь V4DYA). */
const RING_MASK: React.CSSProperties = {
  WebkitMaskImage: HEX_RING_MASK,
  maskImage: HEX_RING_MASK,
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
};

export interface HexRingProgressProps {
  /** Прогресс 0..1 (уверенность в архетипе). Клампится. */
  progress: number;
  /** Акцент-цвет заливки и центральной иконки (CSS-цвет, напр. visual.accent). */
  accent: string;
  /** URL иконки архетипа в центре (visual.iconClass). */
  iconClass: string;
  /** Сторона квадрата в px. По умолчанию 56. */
  size?: number;
}

/**
 * Гекс-кольцо прогресса (Figma «hex-ring-progress-bar»): сегментированное тик-кольцо —
 * трек (lines-hover) + заливка (accent), открываемая conic-маской по углу прогресса.
 * Техника — ВЛОЖЕННЫЕ CSS-маски: внешняя conic (угол прогресса) ∩ внутренняя форма
 * кольца (SVG-ассет). Плавность — транзишн @property `--hex-angle` (globals.css).
 * Центр — иконка архетипа. Нет данных (progress 0) → пустое кольцо (§4.5).
 */
export function HexRingProgress({ progress, accent, iconClass, size = 56 }: HexRingProgressProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const target = clamped * 360;

  // Анимация 0 → target при монтировании (@property --hex-angle транзишится плавно).
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAngle(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const iconSize = Math.round(size * 0.42);
  const conic = 'conic-gradient(#000 var(--hex-angle), transparent var(--hex-angle))';

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Уверенность в архетипе ${Math.round(clamped * 100)}%`}
    >
      {/* Трек — форма кольца в lines-hover */}
      <span className="absolute inset-0" style={{ ...RING_MASK, backgroundColor: 'var(--color-lines-hover)' }} aria-hidden />

      {/* Заливка — внешняя conic-маска (угол) ∩ внутренняя форма кольца */}
      <span
        className="absolute inset-0"
        style={{
          ['--hex-angle' as string]: `${angle}deg`,
          transition: '--hex-angle 0.8s ease-out',
          WebkitMaskImage: conic,
          maskImage: conic,
        }}
        aria-hidden
      >
        <span className="absolute inset-0" style={{ ...RING_MASK, backgroundColor: accent }} />
      </span>

      {/* Центр — иконка архетипа */}
      <span
        className="relative"
        style={{
          width: iconSize,
          height: iconSize,
          backgroundColor: accent,
          WebkitMaskImage: `url(${iconClass})`,
          maskImage: `url(${iconClass})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
        aria-hidden
      />
    </span>
  );
}
