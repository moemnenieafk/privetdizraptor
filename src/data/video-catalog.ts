import type {
  VideoCategoryMeta,
  VideoCategorySlug,
  VideoSort,
} from '@/types/video';

/**
 * Каталог раздела «Видео» — единственный источник правды по контенту.
 * Категория = ПЛЕЙЛИСТ канала @fullkamen: раскладку контролирует автор на YouTube,
 * код при добавлении видео не трогаем. Мы лишь зеркалим плейлисты и обогащаем
 * их фасетами (карта/тема), вычисленными из title+description+tags.
 */

/** Канал-первоисточник. Handle — для channels.list?forHandle (1 юнит квоты). */
export const YT_CHANNEL_HANDLE = '@fullkamen';

/** Twitch-канал того же автора (VOD'ы и хайлайты в категорию «Стримы»). */
export const TWITCH_CHANNEL_LOGIN = 'fullkamen';

/** Сколько последних видео тянем из каждого плейлиста (50 = 1 страница = 1 юнит). */
export const PLAYLIST_PAGE_SIZE = 50;
/** Максимум страниц на плейлист (500 видео = 10 юнитов). Защита от бесконечной пагинации. */
export const PLAYLIST_MAX_PAGES = 10;

/** TTL серверного кэша каталога, сек. Час — компромисс свежесть/квота (10k юнитов/сутки). */
export const CATALOG_TTL = 3600;

/* ─────────────────────── Категории ─────────────────────── */

export const VIDEO_CATEGORIES: VideoCategoryMeta[] = [
  {
    slug: 'guides',
    title: 'Гайды',
    description: 'Подробные видеоруководства по квестам, механикам и сборкам оружия.',
    iconPath: '/icons/eft/06-videos/video-guides.svg',
    playlistId: 'PL_REPLACE_ME_GUIDES', // TODO: ID плейлиста «Гайды»
    includeTwitch: false,
  },
  {
    slug: 'advices',
    title: 'Советы',
    description: 'Короткие и полезные видеосоветы для новичков и опытных игроков.',
    iconPath: '/icons/eft/06-videos/video-advices.svg',
    playlistId: 'PL_REPLACE_ME_ADVICES', // TODO: ID плейлиста «Советы»
    includeTwitch: false,
  },
  {
    slug: 'news',
    title: 'Новости',
    description: 'Официальные новости, анонсы и обзоры обновлений от разработчиков.',
    iconPath: '/icons/eft/06-videos/video-news.svg',
    playlistId: 'PL_REPLACE_ME_NEWS', // TODO: ID плейлиста «Новости»
    includeTwitch: false,
  },
  {
    slug: 'streams',
    title: 'Стримы',
    description: 'Записи трансляций и лучшие моменты с Twitch и YouTube.',
    iconPath: '/icons/eft/06-videos/live-streams.svg',
    playlistId: 'PL_REPLACE_ME_STREAMS', // TODO: ID плейлиста «Стримы» (null — если только Twitch)
    includeTwitch: true,
  },
];

export const CATEGORY_BY_SLUG: Record<VideoCategorySlug, VideoCategoryMeta> =
  VIDEO_CATEGORIES.reduce(
    (acc, c) => ({ ...acc, [c.slug]: c }),
    {} as Record<VideoCategorySlug, VideoCategoryMeta>,
  );

/** Обратный индекс: playlistId → категория (раскладка выдачи YouTube). */
export const CATEGORY_BY_PLAYLIST: Record<string, VideoCategorySlug> =
  VIDEO_CATEGORIES.reduce<Record<string, VideoCategorySlug>>((acc, c) => {
    if (c.playlistId) acc[c.playlistId] = c.slug;
    return acc;
  }, {});

export function isVideoCategory(value: string): value is VideoCategorySlug {
  return VIDEO_CATEGORIES.some((c) => c.slug === value);
}

/* ─────────────────────── Фасеты: карты ─────────────────────── */

/**
 * Словарь распознавания карт в тексте. Ключ = слаг из /eft/maps/[slug],
 * значения = все народные написания (рус/англ/сленг), в нижнем регистре.
 * Матчим по вхождению подстроки — дёшево и достаточно точно для заголовков.
 */
export const MAP_KEYWORDS: Record<string, string[]> = {
  customs: ['таможн', 'customs', 'тамож'],
  factory: ['завод', 'factory'],
  woods: ['лес', 'woods'],
  reserve: ['резерв', 'reserve', 'рб-'],
  shoreline: ['берег', 'shoreline', 'санаторий'],
  interchange: ['развязк', 'interchange', 'ультра'],
  lighthouse: ['маяк', 'lighthouse'],
  streets: ['улиц', 'streets', 'тарков-стрит'],
  lab: ['лаборатор', 'labs', 'the lab', 'терагруп'],
  'groundzero-map': ['эпицентр', 'ground zero', 'граундзеро'],
  terminal: ['терминал', 'terminal'],
};

/* ─────────────────────── Фасеты: темы ─────────────────────── */

export interface VideoTopicMeta {
  id: string;
  label: string;
  keywords: string[];
}

/** Темы — второй ряд чипсов-фильтров. Порядок = порядок отрисовки. */
export const VIDEO_TOPICS: VideoTopicMeta[] = [
  {
    id: 'weapons',
    label: 'Оружие',
    keywords: ['оруж', 'сборк', 'билд', 'ствол', 'патрон', 'бронеб', 'калаш', 'мета-оруж', 'модул'],
  },
  {
    id: 'quests',
    label: 'Квесты',
    keywords: ['квест', 'задани', 'прохожден', 'тайник', 'схрон', 'каппа', 'лайткипер'],
  },
  {
    id: 'hideout',
    label: 'Убежище',
    keywords: ['убежищ', 'hideout', 'крафт', 'биткоин', 'модул'],
  },
  {
    id: 'economy',
    label: 'Экономика',
    keywords: ['барах', 'барт', 'ценн', 'рубл', 'заработ', 'лут', 'фарм', 'профит', 'барыг'],
  },
  {
    id: 'boss',
    label: 'Боссы',
    keywords: ['босс', 'килла', 'решала', 'глухар', 'штурман', 'санитар', 'тагилла', 'культист'],
  },
  {
    id: 'meta',
    label: 'Механики',
    keywords: ['механик', 'настройк', 'звук', 'фпс', 'оптимизац', 'новичк', 'гайд для нович'],
  },
  {
    id: 'wipe',
    label: 'Вайп / Патч',
    keywords: ['вайп', 'wipe', 'патч', 'обновлен', 'старт', 'ивент'],
  },
];

/* ─────────────────────── Сортировка ─────────────────────── */

export const VIDEO_SORTS: { id: VideoSort; label: string }[] = [
  { id: 'new', label: 'Сначала новые' },
  { id: 'old', label: 'Сначала старые' },
  { id: 'popular', label: 'По просмотрам' },
  { id: 'long', label: 'Сначала длинные' },
  { id: 'short', label: 'Сначала короткие' },
];

export function isVideoSort(value: string): value is VideoSort {
  return VIDEO_SORTS.some((s) => s.id === value);
}

/* ─────────────────────── Ручные оверрайды ─────────────────────── */

/**
 * Точечные правки поверх авто-разбора. Нужны редко: когда заголовок врёт
 * (например, «Стрим по квестам» — а по сути гайд) или надо спрятать видео.
 * Ключ — YouTube videoId / Twitch video id.
 */
export interface VideoOverride {
  category?: VideoCategorySlug;
  maps?: string[];
  topics?: string[];
  /** Закрепить в начале выдачи категории (при сортировке «Сначала новые»). */
  pinned?: boolean;
  /** Убрать из архива полностью. */
  hidden?: boolean;
}

export const VIDEO_OVERRIDES: Record<string, VideoOverride> = {
  // 'dQw4w9WgXcQ': { category: 'guides', topics: ['quests'], pinned: true },
};

/** Порог «досмотрено» — доля длительности. Ниже — показываем «Продолжить». */
export const WATCHED_THRESHOLD = 0.92;