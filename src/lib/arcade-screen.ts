// Геометрия аркадного автомата ЦТА. Проценты считаются ОТ ПЛИТЫ (экспортированной
// картинки корпуса), не от вьюпорта. Обмеряно по пикселям на 5 брейкпоинтах в каждом
// режиме — медиазапросы под координаты НЕ нужны, констант ровно две.
// Источник: docs/decisions/cta-arcade-handoff-final.md (§3, §8). НЕ пересчитывать «на глаз».

export type ArcadeView = 'site' | 'fullscreen';

export interface ScreenRect {
  /** Отступ слева, % ширины плиты. */
  readonly left: number;
  /** Отступ сверху, % высоты плиты. */
  readonly top: number;
  /** Высота бокса экрана, % высоты плиты. Ширина выводится из aspect-ratio 4/3. */
  readonly height: number;
}

export interface PlateAsset {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** Контрольная пропорция (width/height). Сверять с фактическим файлом; расхождение
   *  >0.001 = экспортировали не ту ноду, координаты поедут. */
  readonly ratio: number;
}

export const ARCADE_SCREEN: Record<ArcadeView, ScreenRect> = {
  site: { left: 15.962, top: 21.035, height: 22.067 },
  fullscreen: { left: 13.801, top: 13.668, height: 75.0 },
};

export const ARCADE_PLATE: Record<ArcadeView, PlateAsset> = {
  site: { src: '/images/arcade/cabinet-front.webp', width: 1770, height: 4096, ratio: 0.43213 },
  // Клоузап («игрок наклонился к автомату»). Факт: 2984×2160 = 1.38148, эталон 1.38127
  // (расхождение 0.0002 < 0.001 — нода верная).
  fullscreen: {
    src: '/images/arcade/arcademachine_cleanplate_closeup_bg.webp',
    width: 2984,
    height: 2160,
    ratio: 1.38127,
  },
};

/** true, когда плита режима реально экспортирована (есть размеры). */
export function isPlateReady(view: ArcadeView): boolean {
  return ARCADE_PLATE[view].width > 0;
}

/** Плита для рендера. Пока клоузап не экспортирован — фуллскрин временно на фронт-плите
 *  (см. план). Как только dims проставят — переключится автоматически. */
export function resolvePlate(view: ArcadeView): PlateAsset {
  return isPlateReady(view) ? ARCADE_PLATE[view] : ARCADE_PLATE.site;
}

/** Геометрия экрана, согласованная с resolvePlate: фолбэк-плита ⇒ фолбэк-координаты. */
export function resolveScreen(view: ArcadeView): ScreenRect {
  return isPlateReady(view) ? ARCADE_SCREEN[view] : ARCADE_SCREEN.site;
}
