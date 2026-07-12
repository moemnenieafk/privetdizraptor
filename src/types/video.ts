/**
 * Домен «Видео» — единый архив контента @fullkamen (YouTube + Twitch).
 * Источник — Discriminated Union по полю `source`, чтобы плеер/карточка
 * выбирали рендер по типу без каста и без `any`.
 */

/** Слаг категории = сегмент URL /eft/videos/[category] и ключ в HEADER_DICTIONARY. */
export type VideoCategorySlug = 'guides' | 'advices' | 'news' | 'streams';

/** Глава видео (таймкод из описания). start — секунда старта. */
export interface VideoChapter {
  start: number;
  title: string;
}

/**
 * Фасеты фильтрации — вычисляются из title/description/tags по словарям
 * из `video-catalog.ts`. Пустой массив = «не определено», видео попадает
 * в выдачу при любом фильтре по этой оси.
 */
export interface VideoFacets {
  /** Слаги карт EFT: 'customs' | 'streets' | ... (совпадают с /eft/maps/[slug]) */
  maps: string[];
  /** Темы: 'weapons' | 'quests' | 'hideout' | 'economy' | 'meta' | 'wipe' | 'boss' */
  topics: string[];
}

interface VideoBase {
  /** Нативный ID платформы (YouTube videoId / Twitch video id) — он же сегмент URL. */
  id: string;
  title: string;
  description: string;
  /** ISO-8601 UTC. */
  publishedAt: string;
  /** Длительность в секундах. 0 — неизвестна (в т.ч. текущий лайв). */
  duration: number;
  /** Прямой URL превью (maxres → high → medium, что есть). */
  thumbnail: string;
  viewCount: number;
  category: VideoCategorySlug;
  chapters: VideoChapter[];
  facets: VideoFacets;
  /** Внешняя ссылка на оригинал (кнопка «Смотреть на платформе»). */
  externalUrl: string;
}

export interface YoutubeVideo extends VideoBase {
  source: 'youtube';
  /** Плейлист-источник = категория. Держим для отладки рассинхрона с каталогом. */
  playlistId: string;
}

export interface TwitchVideo extends VideoBase {
  source: 'twitch';
  /** archive — VOD трансляции (живёт 14/60 дней), highlight — вечный хайлайт. */
  twitchType: 'archive' | 'highlight' | 'upload';
}

export type Video = YoutubeVideo | TwitchVideo;

/** Сортировка выдачи архива. */
export type VideoSort = 'new' | 'old' | 'popular' | 'long' | 'short';

/** Прогресс просмотра (Zustand persist, localStorage — без БД). */
export interface VideoProgress {
  /** Секунда, на которой остановились. */
  position: number;
  /** Длительность на момент записи — чтобы считать % без повторного запроса. */
  duration: number;
  /** Досмотрено (>= 92% длительности) — карточка гасится, «продолжить» скрывается. */
  completed: boolean;
  /** Unix ms последнего просмотра — сортировка ряда «Продолжить просмотр». */
  updatedAt: number;
}

/** Метаданные категории для хаба и хлебных крошек. */
export interface VideoCategoryMeta {
  slug: VideoCategorySlug;
  title: string;
  description: string;
  iconPath: string;
  /** ID плейлиста YouTube. null → категория тянется не из YouTube (streams → Twitch). */
  playlistId: string | null;
  /** Тянуть ли в эту категорию VOD/хайлайты с Twitch-канала. */
  includeTwitch: boolean;
}

/** Ответ серверного слоя каталога — один контракт для всех страниц раздела. */
export interface VideoCatalogResult {
  videos: Video[];
  /** Мягкая деградация: если платформа отвалилась — показываем что есть + баннер. */
  errors: string[];
}