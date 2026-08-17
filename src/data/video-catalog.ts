import type {
  VideoCategoryMeta,
  VideoCategorySlug,
  VideoSort,
} from '@/types/video';
import { HEADER_DICTIONARY } from '@/data/headerConfig';

/**
 * Каталог раздела «Видео» — единственный источник правды по контенту.
 *
 * КАСКАД ИСТОЧНИКОВ (см. lib/youtube.ts):
 *   1. Если у категории задан playlistId → берём этот плейлист (автор рулит раскладкой).
 *   2. Если ни один не задан → берём uploads-ленту канала целиком и раскладываем
 *      по категориям автоматически (CATEGORY_KEYWORDS).
 * И то, и другое работает БЕЗ API-ключа (через публичный RSS), а с ключом
 * разворачивается в полный архив. Код при этом не меняется.
 */

export const YT_CHANNEL_HANDLE = '@fullkamen';

/** Реальный channel ID @fullkamen. Нужен для RSS и вывода uploads-плейлиста. */
export const YT_CHANNEL_ID = 'UCdIg3tdVwU4G6DArnFd69yQ';

/**
 * Плейлист «все загрузки» канала. YouTube гарантирует правило UC… → UU…,
 * поэтому лишний запрос к channels.list не нужен (экономим и квоту, и ключ).
 */
export const UPLOADS_PLAYLIST_ID = `UU${YT_CHANNEL_ID.slice(2)}`;

/** Twitch-канал того же автора (VOD'ы и хайлайты в категорию «Стримы»). */
export const TWITCH_CHANNEL_LOGIN = 'fullkamen';

export const PLAYLIST_PAGE_SIZE = 50;
export const PLAYLIST_MAX_PAGES = 10;

/** TTL серверного кэша каталога, сек. */
export const CATALOG_TTL = 3600;

/* ─────────────────────── Категории ─────────────────────── */

// Полный каталог категорий с инжест-конфигом (playlistId/twitch). Состав и ПОРЯДОК того, что реально
// показывается и синкается, задаёт верхнее меню (см. VIDEO_CATEGORIES ниже) — это внутренний реестр.
const VIDEO_CATEGORY_CATALOG: VideoCategoryMeta[] = [
  {
    slug: 'guides',
    title: 'Гайды',
    description: 'Подробные видеоруководства по квестам, механикам и сборкам оружия.',
    iconPath: '/icons/eft/06-videos/video-guides.svg',
    // Впиши ID плейлиста, когда Дима его даст (из ссылки ?list=PL…).
    // Пока null — категория наполняется авто-раскладкой из uploads-ленты.
    playlistId: null,
    includeTwitch: false,
  },
  {
    slug: 'advices',
    title: 'Советы',
    description: 'Короткие и полезные видеосоветы для новичков и опытных игроков.',
    iconPath: '/icons/eft/06-videos/video-advices.svg',
    playlistId: null,
    includeTwitch: false,
  },
  {
    slug: 'news',
    title: 'Новости',
    description: 'Официальные новости, анонсы и обзоры обновлений от разработчиков.',
    iconPath: '/icons/eft/06-videos/video-news.svg',
    playlistId: null,
    includeTwitch: false,
  },
  {
    slug: 'streams',
    title: 'Стримы',
    description: 'Записи трансляций и лучшие моменты с Twitch и YouTube.',
    iconPath: '/icons/eft/06-videos/live-streams.svg',
    playlistId: null,
    includeTwitch: true,
  },
];

/**
 * ⚠️ ВЕРХНЕЕ МЕНЮ — ГЛАВНЫЙ РУБИЛЬНИК. Состав и порядок категорий диктуют дети `/eft/videos`
 * из HEADER_DICTIONARY: убрал пункт из меню → категория исчезает ВЕЗДЕ (карточки индекса, роут
 * [category], инжест YouTube/Twitch). Конфиг (playlistId/twitch) живёт в каталоге выше и берётся
 * по slug. Категория без пары в каталоге просто не появится (нужен инжест-конфиг). Единый источник
 * — как у «Прогресса»/«Кодекса»/«Связи».
 */
const VIDEO_BASE = '/eft/videos';
const MENU_VIDEO_SLUGS: string[] = (
  HEADER_DICTIONARY['eft'].menuItems.find((m) => m.path === VIDEO_BASE)?.children ?? []
)
  .map((c) => (c.path ? c.path.slice(VIDEO_BASE.length + 1) : ''))
  .filter(Boolean);

export const VIDEO_CATEGORIES: VideoCategoryMeta[] = MENU_VIDEO_SLUGS
  .map((slug) => VIDEO_CATEGORY_CATALOG.find((c) => c.slug === slug))
  .filter((c): c is VideoCategoryMeta => Boolean(c));

export const CATEGORY_BY_SLUG: Record<VideoCategorySlug, VideoCategoryMeta> =
  VIDEO_CATEGORIES.reduce(
    (acc, c) => ({ ...acc, [c.slug]: c }),
    {} as Record<VideoCategorySlug, VideoCategoryMeta>,
  );

export const CATEGORY_BY_PLAYLIST: Record<string, VideoCategorySlug> =
  VIDEO_CATEGORIES.reduce<Record<string, VideoCategorySlug>>((acc, c) => {
    if (c.playlistId) acc[c.playlistId] = c.slug;
    return acc;
  }, {});

export function isVideoCategory(value: string): value is VideoCategorySlug {
  return VIDEO_CATEGORIES.some((c) => c.slug === value);
}

/* ─────────────────────── Авто-раскладка по категориям ─────────────────────── */

/**
 * Правила для режима uploads-ленты. Проверяются СТРОГО В ЭТОМ ПОРЯДКЕ —
 * первое совпадение выигрывает, поэтому узкие темы («новости», «советы»)
 * стоят выше широких («гайд»). Всё, что не подошло → 'streams'
 * (канал в основе своей — нарезки и лучшие моменты).
 */
export const CATEGORY_KEYWORDS: { slug: VideoCategorySlug; keywords: string[] }[] = [
  {
    slug: 'news',
    keywords: [
      'новост', 'патч', 'обновлен', 'анонс', 'вайп', 'wipe',
      'что нового', 'изменени', 'дневник разраб', 'нас ждёт', 'нас ждет',
    ],
  },
  {
    slug: 'advices',
    keywords: [
      'совет', 'советы', 'лайфхак', 'фишк', 'ошибк', 'новичк',
      'топ-', 'топ ', 'что нужно знать', 'как не', 'подборк',
    ],
  },
  {
    slug: 'guides',
    keywords: [
      'гайд', 'прохожден', 'квест', 'задани', 'сборк', 'билд',
      'разбор', 'обзор', 'как пройти', 'босс', 'убежищ', 'крафт', 'обучен',
    ],
  },
  {
    slug: 'streams',
    keywords: ['стрим', 'нарезк', 'лучшие момент', 'запись', 'моменты'],
  },
];

/** Категория по умолчанию, если ни одно правило не сработало. */
export const FALLBACK_CATEGORY: VideoCategorySlug = 'streams';

/* ─────────────────────── Фасеты: карты ─────────────────────── */

export const MAP_KEYWORDS: Record<string, string[]> = {
  customs: ['таможн', 'customs', 'тамож'],
  factory: ['завод', 'factory'],
  woods: ['лес', 'woods'],
  reserve: ['резерв', 'reserve', 'рб-'],
  shoreline: ['берег', 'shoreline', 'санаторий'],
  interchange: ['развязк', 'interchange', 'ультра'],
  lighthouse: ['маяк', 'lighthouse'],
  streets: ['улиц', 'streets'],
  lab: ['лаборатор', 'labs', 'the lab', 'терагруп'],
  'ground-zero': ['эпицентр', 'ground zero', 'граундзеро'],
  terminal: ['терминал', 'terminal'],
  labyrinth: ['лабиринт', 'labyrinth'],
};

/* ─────────────────────── Фасеты: темы ─────────────────────── */

export interface VideoTopicMeta {
  id: string;
  label: string;
  keywords: string[];
}

export const VIDEO_TOPICS: VideoTopicMeta[] = [
  {
    id: 'weapons',
    label: 'Оружие',
    keywords: ['оруж', 'сборк', 'билд', 'ствол', 'патрон', 'бронеб', 'калаш', 'модул'],
  },
  {
    id: 'quests',
    label: 'Квесты',
    keywords: ['квест', 'задани', 'прохожден', 'тайник', 'схрон', 'каппа', 'лайткипер'],
  },
  {
    id: 'hideout',
    label: 'Убежище',
    keywords: ['убежищ', 'hideout', 'крафт', 'биткоин'],
  },
  {
    id: 'economy',
    label: 'Экономика',
    keywords: ['барах', 'барт', 'ценн', 'рубл', 'заработ', 'лут', 'фарм', 'профит'],
  },
  {
    id: 'boss',
    label: 'Боссы',
    keywords: ['босс', 'килла', 'решала', 'глухар', 'штурман', 'санитар', 'тагилла', 'культист'],
  },
  {
    id: 'meta',
    label: 'Механики',
    keywords: ['механик', 'настройк', 'звук', 'фпс', 'оптимизац', 'новичк'],
  },
  {
    id: 'wipe',
    label: 'Вайп / Патч',
    keywords: ['вайп', 'wipe', 'патч', 'обновлен', 'ивент'],
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

export interface VideoOverride {
  category?: VideoCategorySlug;
  maps?: string[];
  topics?: string[];
  pinned?: boolean;
  hidden?: boolean;
}

/** Точечные правки поверх авто-разбора: перекинуть в другую категорию, закрепить, скрыть. */
export const VIDEO_OVERRIDES: Record<string, VideoOverride> = {
  // 'dQw4w9WgXcQ': { category: 'guides', pinned: true },
};

export const WATCHED_THRESHOLD = 0.92;