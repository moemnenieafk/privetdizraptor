import { unstable_cache } from 'next/cache';
import type { VideoCategorySlug, YoutubeVideo } from '@/types/video';
import {
  CATEGORY_BY_PLAYLIST,
  CATEGORY_KEYWORDS,
  CATALOG_TTL,
  FALLBACK_CATEGORY,
  PLAYLIST_MAX_PAGES,
  PLAYLIST_PAGE_SIZE,
  UPLOADS_PLAYLIST_ID,
  VIDEO_CATEGORIES,
} from '@/data/video-catalog';
import { detectFacets, parseChapters, parseIsoDuration } from '@/lib/video-utils';

/**
 * Загрузчик видео с YouTube. Каскад из двух осей — источник и транспорт:
 *
 *   ИСТОЧНИК:   плейлисты из каталога → иначе uploads-лента канала (UC… → UU…)
 *               с авто-раскладкой по CATEGORY_KEYWORDS.
 *   ТРАНСПОРТ:  YOUTUBE_API_KEY есть → Data API v3 (весь архив, длительность, точные
 *               просмотры). Ключа нет → публичный RSS (без квот и авторизации,
 *               но только 15 последних видео и без длительности).
 *
 * Итог: раздел работает из коробки, а появление ключа/плейлистов в env и каталоге
 * расширяет его БЕЗ правок кода.
 */

const API = 'https://www.googleapis.com/youtube/v3';
const RSS = 'https://www.youtube.com/feeds/videos.xml';

/* ═════════════ Авто-категоризация (режим uploads-ленты) ═════════════ */

function detectCategory(title: string, description: string): VideoCategorySlug {
  const hay = `${title} ${description.slice(0, 300)}`.toLowerCase();
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.keywords.some((w) => hay.includes(w))) return rule.slug;
  }
  return FALLBACK_CATEGORY;
}

/* ═════════════ ТРАНСПОРТ 1: RSS (без ключа) ═════════════ */

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function tagText(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? decodeXml(m[1].trim()) : '';
}

function attr(xml: string, tag: string, name: string): string {
  const m = new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`).exec(xml);
  return m ? decodeXml(m[1]) : '';
}

/** resolveCategory: null → определяем по ключевым словам (uploads-режим). */
async function loadViaRss(
  playlistId: string,
  fixedCategory: VideoCategorySlug | null,
): Promise<YoutubeVideo[]> {
  const res = await fetch(`${RSS}?playlist_id=${encodeURIComponent(playlistId)}`, {
    cache: 'no-store',
    headers: { 'User-Agent': 'CTA-Portal/1.0' },
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);

  const xml = await res.text();
  const entries = xml.split('<entry>').slice(1);

  return entries.reduce<YoutubeVideo[]>((acc, entry) => {
    const id = tagText(entry, 'yt:videoId');
    const title = tagText(entry, 'title');
    if (!id || !title) return acc;

    const description = tagText(entry, 'media:description');

    acc.push({
      source: 'youtube',
      id,
      playlistId,
      category: fixedCategory ?? detectCategory(title, description),
      title,
      description,
      publishedAt: tagText(entry, 'published') || new Date(0).toISOString(),
      duration: 0, // RSS не отдаёт длительность → в UI «—»
      thumbnail:
        attr(entry, 'media:thumbnail', 'url') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      viewCount: Number(attr(entry, 'media:statistics', 'views') || 0),
      chapters: parseChapters(description, 0),
      facets: detectFacets(title, description, []),
      externalUrl: `https://www.youtube.com/watch?v=${id}`,
    });
    return acc;
  }, []);
}

/* ═════════════ ТРАНСПОРТ 2: Data API v3 (с ключом) ═════════════ */

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

async function loadViaApi(
  playlistId: string,
  fixedCategory: VideoCategorySlug | null,
  key: string,
): Promise<YoutubeVideo[]> {
  /* 1. ID видео плейлиста (пагинация) */
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

  /* 2. Детали пачками по 50 (лимит videos.list) */
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

  /* 3. → домен */
  return pages.flatMap((p) => p.items ?? []).reduce<YoutubeVideo[]>((acc, raw) => {
    const id = raw.id;
    const snippet = raw.snippet;
    if (!id || !snippet?.title) return acc;

    const description = snippet.description ?? '';
    const duration = parseIsoDuration(raw.contentDetails?.duration);

    acc.push({
      source: 'youtube',
      id,
      playlistId,
      category: fixedCategory ?? detectCategory(snippet.title, description),
      title: snippet.title,
      description,
      publishedAt: snippet.publishedAt ?? new Date(0).toISOString(),
      duration,
      thumbnail: pickThumbnail(snippet.thumbnails, id),
      viewCount: Number(raw.statistics?.viewCount ?? 0),
      chapters: parseChapters(description, duration),
      facets: detectFacets(snippet.title, description, snippet.tags ?? []),
      externalUrl: `https://www.youtube.com/watch?v=${id}`,
    });
    return acc;
  }, []);
}

/* ═════════════ Оркестрация ═════════════ */

async function loadYoutube(): Promise<{ videos: YoutubeVideo[]; errors: string[] }> {
  const key = process.env.YOUTUBE_API_KEY;
  const errors: string[] = [];

  const load = (playlistId: string, category: VideoCategorySlug | null) =>
    key ? loadViaApi(playlistId, category, key) : loadViaRss(playlistId, category);

  if (!key) {
    errors.push('Без API-ключа YouTube доступны только 15 последних видео');
  }

  /* Плейлисты заданы в каталоге → категория = плейлист. */
  const configured = VIDEO_CATEGORIES.filter((c) => Boolean(c.playlistId));

  const batches = await Promise.all(
    configured.length > 0
      ? configured.map(async (cat) => {
          const playlistId = cat.playlistId as string;
          try {
            return await load(playlistId, CATEGORY_BY_PLAYLIST[playlistId] ?? cat.slug);
          } catch (e) {
            errors.push(`YouTube «${cat.title}»: ${(e as Error).message}`);
            return [];
          }
        })
      : /* Плейлистов нет → uploads-лента канала + авто-раскладка (category = null). */
        [
          load(UPLOADS_PLAYLIST_ID, null).catch((e: Error) => {
            errors.push(`YouTube: ${e.message}`);
            return [] as YoutubeVideo[];
          }),
        ],
  );

  /* Дедуп: одно видео может лежать сразу в двух плейлистах. */
  const seen = new Set<string>();
  const videos: YoutubeVideo[] = [];
  for (const v of batches.flat()) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    videos.push(v);
  }

  return { videos, errors };
}

/**
 * Публичная точка входа. Кэш на CATALOG_TTL. Никогда не бросает: любая ошибка
 * превращается в `errors` и рисуется баннером над сеткой — страница не падает в 500.
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