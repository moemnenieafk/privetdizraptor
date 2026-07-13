
import { unstable_cache } from 'next/cache';
import type { TwitchVideo, Video, VideoCatalogResult } from '@/types/video';
import {
  CATALOG_TTL,
  TWITCH_CHANNEL_LOGIN,
  VIDEO_CATEGORIES,
} from '@/data/video-catalog';
import { applyOverrides, detectFacets, parseChapters } from '@/lib/video-utils';
import { getYoutubeVideos } from '@/lib/youtube';

/**
 * Twitch VOD'ы и хайлайты @fullkamen → категория «Стримы».
 * Переиспользует TWITCH_CLIENT_ID/SECRET (те же, что в /api/twitch-status),
 * новых секретов не требует. helix/videos публичен для app-токена.
 *
 * Важно про срок жизни: type=archive (записи трансляций) хранятся у Twitch
 * 14 дней (60 для Partner/Turbo) и потом пропадают — это нормально, архив
 * самоочищается. type=highlight и upload живут вечно.
 *
 * Здесь же — сводная точка входа каталога: getVideoCatalog().
 */

const HELIX = 'https://api.twitch.tv/helix';
/** Сколько последних записей тянем (лимит helix — 100 на страницу). */
const VOD_LIMIT = 100;

/* ─────────────────── сырые типы helix (без any) ─────────────────── */

interface HelixVideo {
  id?: string;
  title?: string;
  description?: string;
  created_at?: string;
  published_at?: string;
  url?: string;
  thumbnail_url?: string;
  view_count?: number;
  duration?: string; // "1h2m3s"
  type?: string; // archive | highlight | upload
}
interface HelixVideosResponse {
  data?: HelixVideo[];
}
interface HelixUsersResponse {
  data?: { id?: string }[];
}
interface HelixTokenResponse {
  access_token?: string;
  expires_in?: number;
}

/* ─────────────────── низкий уровень ─────────────────── */

// Кэш app-токена в модуле: тёплая serverless-функция переиспользует его между вызовами.
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAppToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: 'POST', cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`Twitch auth ${res.status}`);

  const data = (await res.json()) as HelixTokenResponse;
  if (!data.access_token) throw new Error('Twitch: пустой токен');

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000;
  return cachedToken;
}

/** "1h2m3s" / "45m10s" / "58s" → секунды. */
function parseTwitchDuration(raw: string | undefined): number {
  if (!raw) return 0;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Twitch отдаёт превью с плейсхолдерами %{width}x%{height} — подставляем размер. */
function resolveThumb(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace('%{width}', '640').replace('%{height}', '360');
}

function toTwitchType(raw: string | undefined): TwitchVideo['twitchType'] {
  if (raw === 'highlight' || raw === 'upload') return raw;
  return 'archive';
}

function toVideo(raw: HelixVideo): TwitchVideo | null {
  const id = raw.id;
  if (!id || !raw.title) return null;

  const description = raw.description ?? '';
  const duration = parseTwitchDuration(raw.duration);

  return {
    source: 'twitch',
    twitchType: toTwitchType(raw.type),
    id,
    category: 'streams',
    title: raw.title,
    description,
    publishedAt: raw.published_at ?? raw.created_at ?? new Date(0).toISOString(),
    duration,
    thumbnail: resolveThumb(raw.thumbnail_url),
    viewCount: raw.view_count ?? 0,
    chapters: parseChapters(description, duration),
    facets: detectFacets(raw.title, description, []),
    externalUrl: raw.url ?? `https://www.twitch.tv/videos/${id}`,
  };
}

/* ─────────────────── загрузка ─────────────────── */

async function loadTwitch(): Promise<{ videos: TwitchVideo[]; errors: string[] }> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { videos: [], errors: [] }; // не сконфигурен — молча пропускаем, YouTube хватит
  }

  try {
    const token = await getAppToken(clientId, clientSecret);
    const headers = { 'Client-ID': clientId, Authorization: `Bearer ${token}` };

    const userRes = await fetch(
      `${HELIX}/users?login=${encodeURIComponent(TWITCH_CHANNEL_LOGIN)}`,
      { headers, cache: 'no-store' },
    );
    if (!userRes.ok) throw new Error(`helix/users ${userRes.status}`);
    const userId = ((await userRes.json()) as HelixUsersResponse).data?.[0]?.id;
    if (!userId) return { videos: [], errors: ['Twitch: канал не найден'] };

    const vodRes = await fetch(
      `${HELIX}/videos?user_id=${userId}&first=${VOD_LIMIT}&sort=time`,
      { headers, cache: 'no-store' },
    );
    if (!vodRes.ok) throw new Error(`helix/videos ${vodRes.status}`);

    const raw = ((await vodRes.json()) as HelixVideosResponse).data ?? [];
    const videos = raw
      .map(toVideo)
      .filter((v): v is TwitchVideo => v !== null && v.duration > 0);

    return { videos, errors: [] };
  } catch (e) {
    return { videos: [], errors: [`Twitch: ${(e as Error).message}`] };
  }
}

const getTwitchVideos = unstable_cache(loadTwitch, ['cta-twitch-vods'], {
  revalidate: CATALOG_TTL,
  tags: ['videos'],
});

/* ─────────────────── сводный каталог ─────────────────── */

/** Тянуть ли Twitch вообще — решает флаг includeTwitch в каталоге категорий. */
const TWITCH_ENABLED = VIDEO_CATEGORIES.some((c) => c.includeTwitch);

/**
 * ЕДИНАЯ точка входа для всех страниц раздела «Видео».
 * Платформы грузятся параллельно и деградируют независимо: падение Twitch
 * не мешает показать YouTube (и наоборот) — ошибки уезжают в `errors`
 * и рисуются баннером над сеткой.
 */
export async function getVideoCatalog(): Promise<VideoCatalogResult> {
  const [yt, tw] = await Promise.all([
    getYoutubeVideos().catch((e: Error) => ({ videos: [], errors: [`YouTube: ${e.message}`] })),
    TWITCH_ENABLED ? getTwitchVideos() : Promise.resolve({ videos: [], errors: [] }),
  ]);

  const merged: Video[] = [...yt.videos, ...tw.videos];

  return {
    videos: applyOverrides(merged),
    errors: [...yt.errors, ...tw.errors],
  };
}

/** Одно видео по id — для страницы плеера (переиспользует общий кэш каталога). */
export async function getVideoById(id: string): Promise<Video | null> {
  const { videos } = await getVideoCatalog();
  return videos.find((v) => v.id === id) ?? null;
}

/** Похожие: та же категория, максимум общих фасетов, себя исключаем. */
export async function getRelatedVideos(video: Video, limit = 6): Promise<Video[]> {
  const { videos } = await getVideoCatalog();

  const score = (candidate: Video): number => {
    const maps = candidate.facets.maps.filter((m) => video.facets.maps.includes(m)).length;
    const topics = candidate.facets.topics.filter((t) => video.facets.topics.includes(t)).length;
    return maps * 2 + topics;
  };

  return videos
    .filter((v) => v.id !== video.id && v.category === video.category)
    .sort((a, b) => score(b) - score(a) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit);
}