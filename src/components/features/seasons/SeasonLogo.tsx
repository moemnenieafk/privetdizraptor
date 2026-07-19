import type { CSSProperties } from 'react';

// Сезонный логотип с диджитал-эффектом: неоновое свечение + CRT-сканлайны + бегущая
// развёртка. Сканлайны и развёртка ограничены силуэтом лого через mask-image (тот же
// SVG), чтобы эффект ложился только на графику, а не на прямоугольную область.
// Классы и keyframes — в globals.css (@layer utilities), с учётом prefers-reduced-motion.
export function SeasonLogo({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  /** Задаёт высоту (напр. "h-11" / "h-12 sm:h-14"); ширина считается по аспекту. */
  className?: string;
}) {
  const mask: CSSProperties = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'left center',
    maskPosition: 'left center',
  };

  return (
    <span className={`relative inline-block ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="season-logo-img h-full w-auto" />
      <span aria-hidden className="season-logo-scan pointer-events-none absolute inset-0" style={mask} />
      <span aria-hidden className="season-logo-sweep pointer-events-none absolute inset-0" style={mask} />
    </span>
  );
}
