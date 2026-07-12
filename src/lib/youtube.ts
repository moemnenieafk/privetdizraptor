import 'server-only';
import { unstable_cache } from 'next/cache';
import type { VideoCategorySlug, YoutubeVideo } from '@/types/video';
import {
  CATEGORY_BY_PLAYLIST,
  CATALOG_TTL,
  PLAYLIST_MAX_PAGES,
  PLAYLIST_PAGE_SIZE,
  VIDEO_CATEGORIES,
  YT_CHANNEL_HANDLE,
} from '@/data/video-catalog';
import { detectFacets, parseChapters, parseIsoDuration } from '@/lib/video-utils';

/**
 * Серверный клиент YouTube Data API v3. ЕДИНСТВЕННОЕ место, где мы ходим в googleapis.
 *
 * Модель: категория = плейлист канала (раскладку держит автор на YouTube).
 * Квота: channels.list = 1 юнит, playlistItems.list = 1 юнит / 50 видео,
 * videos.list = 1 юнит / 50 id. Полный архив ~500 видео ≈ 20 юнитов из 10 000/сутки.
 * Сверху — unstable_cache на CATALOG_TTL, так что реальных вызовов ≈ 24/сутки.
 */

const API = 'https://www.googleapis.com/youtube/v3';

/* ─────────────────── сырые типы ответа API (без any) ─────────────────── */

interface YtThumb {
  url: string;
}
interface YtThumbnails {
  medium?: YtThumb;
  high?: YtThumb;
  standard?: YtThumb;
  maxres?: YtThumb;
}
interface YtPlaylistItem {
  contentDetails?: { videoId?: string };
}
interface YtPlaylistItemsResponse {
  items?: YtPlaylistItem[];
  nextPageToken?: string;
}
interface YtVideoItem {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: YtThumbnails;
    tags?: string[];
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
}
interface YtVideosResponse {
  items?: YtVideoItem[];
}
interface YtChannelsResponse {
  items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
}

/* ─────────────────────────── низкий уровень ─────────────────────────── */

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY не задан');
  return key;
}

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: apiKey() });
  // no-store: слой кэширования — наш unstable_cache, дублировать fetch-кэш не нужно.
  const res = await fetch(`${API}/${path}?${qs}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube ${path} ${res.status}: ${body.slice(0, 180)}`);
  }
  return (await res.json()) as T;
}

function pickThumbnail(t: YtThumbnails | undefined, videoId: string): string {
  return (
    t?.maxres?.url ??
    t?.standard?.url ??
    t?.high?.url ??
    t?.medium?.url ??
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  );
}

/** Uploads-плейлист канала — фолбэк, если в каталоге не проставлены ID плейлистов. */
async function fetchUploadsPlaylistId(): Promise<string | null> {
  const data = await ytFetch<YtChannelsResponse>('channels', {
    part: 'contentDetails',
    forHandle: YT_CHANNEL_HANDLE,
  });
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

/** Все videoId плейлиста (пагинация до PLAYLIST_MAX_PAGES страниц). */
async function fetchPlaylistVideoIds(playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < PLAYLIST_MAX_PAGES; page += 1) {
    const params: Record<string, string> = {
      part: 'contentDetails',
      playlistId,
      maxResults: String(PLAYLIST_PAGE_SIZE),
      fields: 'items/contentDetails/videoId,nextPageToken',
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await ytFetch<YtPlaylistItemsResponse>('playlistItems', params);
    for (const item of data.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return ids;
}

/** Детали пачками по 50 id (лимит videos.list). */
async function fetchVideoDetails(ids: string[]): Promise<YtVideoItem[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  const pages = await Promise.all(
    chunks.map((chunk) =>
      ytFetch<YtVideosResponse>('videos', {
        part: 'snippet,contentDetails,statistics',
        id: chunk.join(','),
        fields:
          'items(id,snippet(title,description,publishedAt,tags,thumbnails),contentDetails/duration,statistics/viewCount)',
      }),
    ),
  );
  return pages.flatMap((p) => p.items ?? []);
}

/* ─────────────────────────── сборка домена ─────────────────────────── */

function toVideo(
  raw: YtVideoItem,
  category: VideoCategorySlug,
  playlistId: string,
): YoutubeVideo | null {
  const id = raw.id;
  const snippet = raw.snippet;
  if (!id || !snippet?.title) return null;

  const description = snippet.description ?? '';
  const duration = parseIsoDuration(raw.contentDetails?.duration);

  return {
    source: 'youtube',
    id,
    playlistId,
    category,
    title: snippet.title,
    description,
    publishedAt: snippet.publishedAt ?? new Date(0).toISOString(),
    duration,
    thumbnail: pickThumbnail(snippet.thumbnails, id),
    viewCount: Number(raw.statistics?.viewCount ?? 0),
    chapters: parseChapters(description, duration),
    facets: detectFacets(snippet.title, description, snippet.tags ?? []),
    externalUrl: `https://www.youtube.com/watch?v=${id}`,
  };
}

/**
 * Тянет ВСЕ настроенные плейлисты канала и раскладывает видео по категориям.
 * Плейлисты грузятся параллельно; падение одного не роняет остальные —
 * его ошибка уезжает в `errors` и показывается баннером в UI.
 */
async function loadYoutube(): Promise<{ videos: YoutubeVideo[]; errors: string[] }> {
  const configured = VIDEO_CATEGORIES.filter((c) => Boolean(c.playlistId));
  const errors: string[] = [];

  // Ни одного плейлиста в каталоге → берём uploads-ленту целиком в «Гайды».
  if (configured.length === 0) {
    try {
      const uploads = await fetchUploadsPlaylistId();
      if (!uploads) return { videos: [], errors: ['YouTube: канал не найден'] };
      const ids = await fetchPlaylistVideoIds(uploads);
      const details = await fetchVideoDetails(ids);
      const videos = details
        .map((raw) => toVideo(raw, 'guides', uploads))
        .filter((v): v is YoutubeVideo => v !== null);
      return { videos, errors };
    } catch (e) {
      return { videos: [], errors: [`YouTube: ${(e as Error).message}`] };
    }
  }

  const results = await Promise.all(
    configured.map(async (cat) => {
      const playlistId = cat.playlistId as string;
      try {
        const ids = await fetchPlaylistVideoIds(playlistId);
        const details = await fetchVideoDetails(ids);
        const category = CATEGORY_BY_PLAYLIST[playlistId] ?? cat.slug;
        return details
          .map((raw) => toVideo(raw, category, playlistId))
          .filter((v): v is YoutubeVideo => v !== null);
      } catch (e) {
        errors.push(`YouTube «${cat.title}»: ${(e as Error).message}`);
        return [];
      }
    }),
  );

  // Дедуп: одно видео может лежать в двух плейлистах — берём первое вхождение.
  const seen = new Set<string>();
  const videos: YoutubeVideo[] = [];
  for (const v of results.flat()) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    videos.push(v);
  }
  return { videos, errors };
}

/**
 * Публичная точка входа. Кэш на CATALOG_TTL: все страницы раздела за час
 * обслуживаются одним походом в YouTube. Ошибка внутри не кэшируется как
 * «пусто навсегда» — на следующий тик кэш перестроится.
 */
export const getYoutubeVideos = unstable_cache(loadYoutube, ['cta-youtube-catalog'], {
  revalidate: CATALOG_TTL,
  tags: ['videos'],
});