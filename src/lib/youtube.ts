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
 * Серверный загрузчик видео с YouTube. ДВА РЕЖИМА, переключается сам:
 *
 *   1. YOUTUBE_API_KEY задан  → Data API v3. Полный архив плейлиста (до 500 видео),
 *      есть длительность и точные просмотры. Квота: ~20 юнитов из 10 000/сутки.
 *   2. Ключа нет              → публичный RSS плейлиста (feeds/videos.xml).
 *      Без авторизации и без квот, но: только 15 последних видео на плейлист
 *      и НЕТ длительности (duration = 0, в UI покажется «—»).
 *
 * Смысл фолбэка: раздел живой сразу, а появление ключа в env разворачивает
 * архив до полного БЕЗ правок кода. Категория = плейлист в обоих режимах.
 */

const API = 'https://www.googleapis.com/youtube/v3';
const RSS = 'https://www.youtube.com/feeds/videos.xml';

/* ═════════════════ РЕЖИМ 2: RSS (без ключа) ═════════════════ */

/** Достаёт содержимое первого <tag ...>…</tag>. XML-парсера в рантайме нет — режем регуляркой. */
function tagText(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? decodeXml(m[1].trim()) : '';
}

function attr(xml: string, tag: string, name: string): string {
  const m = new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`).exec(xml);
  return m ? decodeXml(m[1]) : '';
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

async function loadPlaylistViaRss(
  playlistId: string,
  category: VideoCategorySlug,
): Promise<YoutubeVideo[]> {
  const res = await fetch(`${RSS}?playlist_id=${encodeURIComponent(playlistId)}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);

  const xml = await res.text();
  const entries = xml.split('<entry>').slice(1);

  return entries.reduce<YoutubeVideo[]>((acc, entry) => {
    const id = tagText(entry, 'yt:videoId');
    const title = tagText(entry, 'title');
    if (!id || !title) return acc;

    const description = tagText(entry, 'media:description');
    const views = Number(attr(entry, 'media:statistics', 'views') || 0);

    acc.push({
      source: 'youtube',
      id,
      playlistId,
      category,
      title,
      description,
      publishedAt: tagText(entry, 'published') || new Date(0).toISOString(),
      duration: 0, // RSS не отдаёт длительность — UI покажет «—»
      thumbnail:
        attr(entry, 'media:thumbnail', 'url') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      viewCount: views,
      chapters: parseChapters(description, 0),
      facets: detectFacets(title, description, []),
      externalUrl: `https://www.youtube.com/watch?v=${id}`,
    });
    return acc;
  }, []);
}

/* ═════════════════ РЕЖИМ 1: Data API v3 (с ключом) ═════════════════ */

interface YtThumb {
  url: string;
}
interface YtThumbnails {
  medium?: YtThumb;
  high?: YtThumb;
  standard?: YtThumb;
  maxres?: YtThumb;
}
interface YtPlaylistItemsResponse {
  items?: { contentDetails?: { videoId?: string } }[];
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

async function ytFetch<T>(
  path: string,
  params: Record<string, string>,
  key: string,
): Promise<T> {
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${API}/${path}?${qs}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} ${res.status}: ${body.slice(0, 140)}`);
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

async function fetchPlaylistVideoIds(playlistId: string, key: string): Promise<string[]> {
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

    const data = await ytFetch<YtPlaylistItemsResponse>('playlistItems', params, key);
    for (const item of data.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return ids;
}

async function fetchVideoDetails(ids: string[], key: string): Promise<YtVideoItem[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  const pages = await Promise.all(
    chunks.map((chunk) =>
      ytFetch<YtVideosResponse>(
        'videos',
        {
          part: 'snippet,contentDetails,statistics',
          id: chunk.join(','),
          fields:
            'items(id,snippet(title,description,publishedAt,tags,thumbnails),contentDetails/duration,statistics/viewCount)',
        },
        key,
      ),
    ),
  );
  return pages.flatMap((p) => p.items ?? []);
}

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

async function loadPlaylistViaApi(
  playlistId: string,
  category: VideoCategorySlug,
  key: string,
): Promise<YoutubeVideo[]> {
  const ids = await fetchPlaylistVideoIds(playlistId, key);
  const details = await fetchVideoDetails(ids, key);
  return details
    .map((raw) => toVideo(raw, category, playlistId))
    .filter((v): v is YoutubeVideo => v !== null);
}

/** Uploads-плейлист канала — фолбэк, если ID плейлистов не проставлены (только с ключом). */
async function fetchUploadsPlaylistId(key: string): Promise<string | null> {
  const data = await ytFetch<YtChannelsResponse>(
    'channels',
    { part: 'contentDetails', forHandle: YT_CHANNEL_HANDLE },
    key,
  );
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

/* ═════════════════ Оркестрация ═════════════════ */

async function loadYoutube(): Promise<{ videos: YoutubeVideo[]; errors: string[] }> {
  const key = process.env.YOUTUBE_API_KEY;
  const errors: string[] = [];

  // Плейлисты, у которых ID реально проставлен (не PL_REPLACE_ME_*).
  const configured = VIDEO_CATEGORIES.filter(
    (c) => c.playlistId && !c.playlistId.startsWith('PL_REPLACE_ME'),
  );

  if (configured.length === 0) {
    // Без плейлистов и без ключа сделать нечего — отдаём пустой архив с внятной причиной.
    if (!key) {
      return {
        videos: [],
        errors: ['YouTube: не заданы ID плейлистов в src/data/video-catalog.ts'],
      };
    }
    try {
      const uploads = await fetchUploadsPlaylistId(key);
      if (!uploads) return { videos: [], errors: ['YouTube: канал не найден'] };
      const videos = await loadPlaylistViaApi(uploads, 'guides', key);
      return { videos, errors };
    } catch (e) {
      return { videos: [], errors: [`YouTube: ${(e as Error).message}`] };
    }
  }

  if (!key) errors.push('YouTube: без API-ключа доступны только 15 последних видео на раздел');

  const results = await Promise.all(
    configured.map(async (cat) => {
      const playlistId = cat.playlistId as string;
      const category = CATEGORY_BY_PLAYLIST[playlistId] ?? cat.slug;
      try {
        return key
          ? await loadPlaylistViaApi(playlistId, category, key)
          : await loadPlaylistViaRss(playlistId, category);
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
 * обслуживаются одним походом наружу. Никогда не бросает — ошибки уезжают
 * в `errors` и рисуются баннером над сеткой (страница не должна падать в 500).
 */
export const getYoutubeVideos = unstable_cache(
  async () => {
    try {
      return await loadYoutube();
    } catch (e) {
      return { videos: [], errors: [`YouTube: ${(e as Error).message}`] };
    }
  },
  ['cta-youtube-catalog'],
  { revalidate: CATALOG_TTL, tags: ['videos'] },
);