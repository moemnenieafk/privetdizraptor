/**
 * База данных всех проектов (карточек) для хаба.
 * Внимание: этот файл должен находиться по пути src/data/games.ts
 */

export type LogoConfigMask = {
  type: 'mask';
  src: string;
  width: number;
  height: number;
};

export type LogoConfigMultiState = {
  type: 'multi-state';
  default: string;
  hover: string;
  inactive: string;
  width: number;
  height: number;
};

export type LogoConfig = LogoConfigMask | LogoConfigMultiState | string;

export interface Game {
  id: string;
  title: string;
  subtitle: string;
  bg: string;
  bgHover: string;
  bgInactive: string;
  videoWebm: string;
  videoMp4: string;
  logo: LogoConfig;
  hoverClass: string;
  themeClass: string;
  isInactive: boolean;
}

/** Отображаемое имя игры по её id раздела (fallback — сам id). */
export const getGameTitle = (id: string): string =>
  GAMES_DATA.find((g) => g.id === id)?.title ?? id;

export const GAMES_DATA: Game[] = [
  {
    id: 'eft',
    title: 'Escape from Tarkov',
    subtitle: 'Минимум кликов — Максимум выживания',
    bg: '/games/eft/bg.webp',
    bgHover: '/games/eft/bg-hover.webp',
    bgInactive: '/games/eft/bg-inactive.webp',
    videoWebm: '/games/eft/video-loop.webm',
    videoMp4: '/games/eft/video-loop.mp4',
    logo: { type: 'mask', src: '/games/eft/eft-logo.svg', width: 122, height: 42 },
    hoverClass: 'hover:shadow-eft',
    themeClass: 'theme-eft',
    isInactive: false,
  },
  {
    id: 'frago',
    title: 'Fragmentary Order',
    subtitle: 'В РАЗРАБОТКЕ...',
    bg: '/games/frago/bg.webp',
    bgHover: '/games/frago/bg-hover.webp',
    bgInactive: '/games/frago/bg-inactive.webp',
    videoWebm: '/games/frago/video-loop.webm',
    videoMp4: '/games/frago/video-loop.mp4',
    logo: { type: 'mask', src: '/games/frago/frago-logo.svg', width: 116, height: 42 },
    hoverClass: 'hover:shadow-frago',
    themeClass: 'theme-frago',
    isInactive: false,
  },
  {
    id: 'abi',
    title: 'Arena Breakout: Infinite',
    subtitle: 'В РАЗРАБОТКЕ...',
    bg: '/games/abi/bg.webp',
    bgHover: '/games/abi/bg-hover.webp',
    bgInactive: '/games/abi/bg-inactive.webp',
    videoWebm: '/games/abi/video-loop.webm',
    videoMp4: '/games/abi/video-loop.mp4',
    logo: { type: 'mask', src: '/games/abi/abi-logo.svg', width: 122, height: 42 },
    hoverClass: 'hover:shadow-abi',
    themeClass: 'theme-abi',
    isInactive: false,
  },
  {
    id: 'gzw',
    title: 'Gray Zone Warfare',
    subtitle: 'В РАЗРАБОТКЕ...',
    bg: '/games/gzw/bg.webp',
    bgHover: '/games/gzw/bg-hover.webp',
    bgInactive: '/games/gzw/bg-inactive.webp',
    videoWebm: '/games/gzw/video-loop.webm',
    videoMp4: '/games/gzw/video-loop.mp4',
    logo: { type: 'mask', src: '/games/gzw/gzw-logo.svg', width: 119, height: 35 },
    hoverClass: 'hover:shadow-gzw',
    themeClass: 'theme-gzw',
    isInactive: false,
  },
  {
    id: 'arcraiders',
    title: 'Arc Raiders',
    subtitle: 'В РАЗРАБОТКЕ...',
    bg: '/games/arcraiders/bg.webp',
    bgHover: '/games/arcraiders/bg-hover.webp',
    bgInactive: '/games/arcraiders/bg-inactive.webp',
    videoWebm: '/games/arcraiders/video-loop.webm',
    videoMp4: '/games/arcraiders/video-loop.mp4',
    logo: { type: 'multi-state', default: '/games/arcraiders/arcraiders-logo.svg', hover: '/games/arcraiders/arcraiders-logo-hover.svg', inactive: '/games/arcraiders/arcraiders-logo.svg', width: 113, height: 35 },
    hoverClass: 'hover:shadow-arcr',
    themeClass: 'theme-arcr',
    isInactive: false,
  },
  {
    id: 'marathon',
    title: 'Marathon',
    subtitle: 'В РАЗРАБОТКЕ...',
    bg: '/games/marathon/bg.webp',
    bgHover: '/games/marathon/bg-hover.webp',
    bgInactive: '/games/marathon/bg-inactive.webp',
    videoWebm: '/games/marathon/video-loop.webm',
    videoMp4: '/games/marathon/video-loop.mp4',
    logo: { type: 'mask', src: '/games/marathon/marathon-logo.svg', width: 96, height: 31 },
    hoverClass: 'hover:shadow-mrthn',
    themeClass: 'theme-mrthn',
    isInactive: false,
  },
  {
    id: 'actmat',
    title: 'Active Matter',
    subtitle: 'В РАЗРАБОТКЕ...',
    bg: '/games/actmat/bg.webp',
    bgHover: '/games/actmat/bg-hover.webp',
    bgInactive: '/games/actmat/bg-inactive.webp',
    videoWebm: '/games/actmat/video-loop.webm',
    videoMp4: '/games/actmat/video-loop.mp4',
    logo: { type: 'mask', src: '/games/actmat/actmat-logo.svg', width: 116, height: 42 },
    hoverClass: 'hover:shadow-actmat',
    themeClass: 'theme-actmat',
    isInactive: false,
  },
  {
    id: 'wardogs',
    title: 'Wardogs',
    subtitle: 'В РАЗРАБОТКЕ...',
    bg: '/games/wardogs/bg.webp',
    bgHover: '/games/wardogs/bg-hover.webp',
    bgInactive: '/games/wardogs/bg-inactive.webp',
    videoWebm: '/games/wardogs/video-loop.webm',
    videoMp4: '/games/wardogs/video-loop.mp4',
    logo: { type: 'multi-state', default: '/games/wardogs/wardogs-logo.svg', hover: '/games/wardogs/wardogs-logo-hover.svg', inactive: '/games/wardogs/wardogs-logo.svg', width: 141, height: 28 },
    hoverClass: 'hover:shadow-wdg',
    themeClass: 'theme-wdg',
    isInactive: false,
  },
];