import type {
  Video,
  VideoChapter,
  VideoFacets,
  VideoSort,
} from '@/types/video';
import {
  MAP_KEYWORDS,
  VIDEO_OVERRIDES,
  VIDEO_TOPICS,
  WATCHED_THRESHOLD,
} from '@/data/video-catalog';

/**
 * Чистые хелперы домена «Видео»: парсинг метаданных платформ и клиентская
 * фильтрация/сортировка выдачи. Без побочек, без сети — используются
 * и на сервере (сборка каталога), и в клиентских компонентах архива.
 */

/* ─────────────────────── длительность ─────────────────────── */

/** ISO-8601 (`PT1H2M3S`) → секунды. Пустое/битое → 0. */
export function parseIsoDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, h, min, s] = m;
  return Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

/** Секунды → `1:02:03` / `7:05`. Для бейджа на превью и глав. */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 1234567 → «1,2 млн». Компактно для мобильной карточки. */
export function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1).replace('.', ',')} млн`;
  if (views >= 1_000) return `${Math.round(views / 1000)} тыс.`;
  return String(views);
}

/** ISO-дата → «3 дня назад» / «2 мес. назад». */
export function formatAge(publishedAt: string): string {
  const diff = Date.now() - new Date(publishedAt).getTime();
  const day = 86_400_000;
  const days = Math.floor(diff / day);
  if (days < 1) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 30) return `${days} дн. назад`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} мес. назад`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'год' : 'г.'} назад`;
}

/* ─────────────────────── главы (таймкоды) ─────────────────────── */

const TIMECODE_LINE = /^\s*\(?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\)?\s*[-–—:.)]*\s*(.+?)\s*$/;

function timecodeToSeconds(code: string): number {
  const parts = code.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

/**
 * Достаёт главы из описания: строки вида `00:00 Вступление`, `[1:23] — Сборка`.
 * Правила YouTube: главы валидны только если их ≥3 и первая начинается с 0:00.
 * Мы мягче — принимаем ≥2, но всё равно чистим мусор (кадры > длительности,
 * непоследовательные таймкоды) и сортируем по возрастанию.
 */
export function parseChapters(description: string, duration: number): VideoChapter[] {
  const found: VideoChapter[] = [];

  for (const line of description.split('\n')) {
    const m = TIMECODE_LINE.exec(line);
    if (!m) continue;
    const start = timecodeToSeconds(m[1]);
    const title = m[2].replace(/^[-–—:.)\s]+/, '').trim();
    if (!title || title.length > 90) continue;
    if (duration > 0 && start >= duration) continue;
    found.push({ start, title });
  }

  if (found.length < 2) return [];

  const sorted = found.sort((a, b) => a.start - b.start);
  const unique: VideoChapter[] = [];
  for (const ch of sorted) {
    if (unique.some((u) => u.start === ch.start)) continue;
    unique.push(ch);
  }
  return unique;
}

/* ─────────────────────── фасеты (карта / тема) ─────────────────────── */

/**
 * Определяет карты и темы по заголовку + описанию + тегам.
 * Описание режем до 600 символов: дальше идут ссылки, таймкоды и реклама —
 * они дают ложные срабатывания.
 */
export function detectFacets(title: string, description: string, tags: string[]): VideoFacets {
  const haystack = [title, description.slice(0, 600), tags.join(' ')]
    .join(' ')
    .toLowerCase();

  const maps = Object.entries(MAP_KEYWORDS)
    .filter(([, words]) => words.some((w) => haystack.includes(w)))
    .map(([slug]) => slug);

  const topics = VIDEO_TOPICS.filter((t) =>
    t.keywords.some((w) => haystack.includes(w)),
  ).map((t) => t.id);

  return { maps, topics };
}

/* ─────────────────────── оверрайды ─────────────────────── */

/** Применяет ручные правки из VIDEO_OVERRIDES и выкидывает скрытые видео. */
export function applyOverrides(videos: Video[]): Video[] {
  return videos.reduce<Video[]>((acc, video) => {
    const patch = VIDEO_OVERRIDES[video.id];
    if (patch?.hidden) return acc;
    if (!patch) {
      acc.push(video);
      return acc;
    }
    acc.push({
      ...video,
      category: patch.category ?? video.category,
      facets: {
        maps: patch.maps ?? video.facets.maps,
        topics: patch.topics ?? video.facets.topics,
      },
    });
    return acc;
  }, []);
}

export function isPinned(video: Video): boolean {
  return VIDEO_OVERRIDES[video.id]?.pinned === true;
}

/* ─────────────────────── фильтр + сортировка ─────────────────────── */

export interface VideoQuery {
  search: string;
  /** Слаги карт. Пусто — без ограничения. Логика OR внутри оси. */
  maps: string[];
  /** ID тем. Пусто — без ограничения. Логика OR внутри оси. */
  topics: string[];
  sort: VideoSort;
}

export const EMPTY_QUERY: VideoQuery = { search: '', maps: [], topics: [], sort: 'new' };

function matchesQuery(video: Video, q: VideoQuery): boolean {
  if (q.maps.length > 0 && !q.maps.some((m) => video.facets.maps.includes(m))) return false;
  if (q.topics.length > 0 && !q.topics.some((t) => video.facets.topics.includes(t))) return false;

  if (q.search.trim()) {
    const needle = q.search.trim().toLowerCase();
    const hay = `${video.title} ${video.chapters.map((c) => c.title).join(' ')}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

const COMPARATORS: Record<VideoSort, (a: Video, b: Video) => number> = {
  new: (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  old: (a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt),
  popular: (a, b) => b.viewCount - a.viewCount,
  long: (a, b) => b.duration - a.duration,
  short: (a, b) => a.duration - b.duration,
};

/**
 * Фильтрация + сортировка выдачи. Закреплённые (pinned) всегда сверху —
 * но только при сортировке «Сначала новые», иначе они ломают смысл сортировки.
 */
export function queryVideos(videos: Video[], q: VideoQuery): Video[] {
  const filtered = videos.filter((v) => matchesQuery(v, q));
  const sorted = [...filtered].sort(COMPARATORS[q.sort]);
  if (q.sort !== 'new') return sorted;
  return [...sorted.filter(isPinned), ...sorted.filter((v) => !isPinned(v))];
}

/** Какие фасеты реально встречаются в наборе — чипсы-пустышки не рисуем. */
export function availableFacets(videos: Video[]): VideoFacets {
  const maps = new Set<string>();
  const topics = new Set<string>();
  for (const v of videos) {
    v.facets.maps.forEach((m) => maps.add(m));
    v.facets.topics.forEach((t) => topics.add(t));
  }
  return { maps: [...maps], topics: [...topics] };
}

/* ─────────────────────── прогресс просмотра ─────────────────────── */

export function isWatched(position: number, duration: number): boolean {
  return duration > 0 && position / duration >= WATCHED_THRESHOLD;
}

export function progressPercent(position: number, duration: number): number {
  if (duration <= 0) return 0;
  return Math.min(100, Math.round((position / duration) * 100));
}