import Image from 'next/image';
import type { ReactNode } from 'react';
import { resolvePlate, resolveScreen, type ArcadeView } from '@/lib/arcade-screen';

// Тупой атом: корпус аркадного автомата + бокс экрана + слой стекла.
// КРИТИЧНО (хендофф §1, §8): дырку в плите НЕ резать, SVG-маску/clip-path НЕ вешать,
// transform к боксу экрана НЕ применять. Порядок слоёв:
//   1. плита — цельная <Image> В ПОТОКЕ (block h-auto w-full, НЕ fill, НЕ object-cover),
//      тогда высота контейнера = высоте картинки и проценты всегда точны;
//   2. children (канвас игры) — absolute по % от плиты, aspect-ratio 4/3, overflow-hidden;
//   3. стекло — absolute pointer-events-none поверх, CSS inset-shadow (без ассета).

interface ArcadeFrameProps {
  view: ArcadeView;
  children: ReactNode;
  /** next/image sizes. Маркиза «ARCADE» точечная — нужен корректный размер, иначе
   *  браузерный даунскейл 1770→280 её замылит (хендофф §2). */
  sizes?: string;
  className?: string;
}

export function ArcadeFrame({ view, children, sizes, className }: ArcadeFrameProps) {
  const plate = resolvePlate(view);
  const rect = resolveScreen(view);

  return (
    <div className={`relative ${className ?? ''}`}>
      <Image
        src={plate.src}
        width={plate.width}
        height={plate.height}
        alt=""
        aria-hidden
        priority={view === 'fullscreen'}
        draggable={false}
        sizes={sizes ?? (view === 'fullscreen' ? '100vw' : '(max-width: 640px) 88vw, 340px')}
        className="block h-auto w-full select-none"
      />

      <div
        className="absolute overflow-hidden"
        style={{
          left: `${rect.left}%`,
          top: `${rect.top}%`,
          height: `${rect.height}%`,
          aspectRatio: '4 / 3',
        }}
      >
        {children}
        {/* Слой стекла: потемнение по кромке, чтобы канвас не читался вклеенным. */}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.6),inset_0_3px_14px_rgb(0_0_0/0.5)]" />
      </div>
    </div>
  );
}
