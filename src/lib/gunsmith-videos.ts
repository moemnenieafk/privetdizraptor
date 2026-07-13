// Видео-гайды к квестам «Оружейник» — плейлист ФУЛЛ КАМЕНЬ (51 видео).
//
// Матчим по номеру части: из названия видео вытаскиваем «Часть N» и связываем
// с gunsmith_specs.part. Никакой ручной таблицы соответствий — она бы протухла
// на первом же новом видео.
//
// Кэш на сутки (next.revalidate): квота YouTube Data API — 10 000 юнитов в день,
// один запрос playlistItems стоит 1 юнит, но страница квеста рендерится часто.
//
// Без YOUTUBE_API_KEY функция молча возвращает пустую карту — видео просто не
// показывается, страница квеста работает как работала. Видео это бонус, не основа.

/** Плейлист «ОРУЖЕЙНИК / Сборки для квеста» (ФУЛЛ КАМЕНЬ). */
const PLAYLIST_ID = "PLzLtPGvlM-v5f1pC-MLwEKpLMkPJ6GaVV";

const API = "https://www.googleapis.com/youtube/v3/playlistItems";
const DAY = 86_400;

export interface GunsmithVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  /** Превью с YouTube CDN — на нашу R2 не зеркалим, это чужой контент. */
  thumbnailUrl: string;
  url: string;
}

/* ───────────────── сырой ответ ───────────────── */

interface RawThumb {
  url?: string;
}
interface RawSnippet {
  title?: string;
  publishedAt?: string;
  thumbnails?: { medium?: RawThumb; high?: RawThumb; default?: RawThumb };
  resourceId?: { videoId?: string };
}
interface RawItem {
  snippet?: RawSnippet;
}
interface RawResponse {
  items?: RawItem[];
  nextPageToken?: string;
  error?: { message?: string };
}

/**
 * Номер части из названия видео. Ловим варианты, которыми реально пишут:
 *   «Оружейник Часть 7», «Оружейник. Часть 7», «Оружейник — часть 7», «ЧАСТЬ 7».
 * Ограничиваем 1–2 цифрами, чтобы не поймать «2025» из заголовка.
 */
function partFromTitle(title: string): number | null {
  const m = title.match(/част[ьи]\s*[:№.\-–—]?\s*(\d{1,2})\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchPage(
  apiKey: string,
  pageToken?: string,
): Promise<{ items: RawItem[]; next?: string }> {
  const url = new URL(API);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("playlistId", PLAYLIST_ID);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("maxResults", "50");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await fetch(url.toString(), { next: { revalidate: DAY } });
  if (!res.ok) throw new Error(`YouTube → ${res.status}`);

  const json = (await res.json()) as RawResponse;
  if (json.error) throw new Error(`YouTube: ${json.error.message ?? "unknown"}`);

  return { items: json.items ?? [], next: json.nextPageToken };
}

/**
 * Карта «номер части квеста → видео». Если на одну часть несколько видео
 * (в плейлисте есть переснятые версии), берём САМОЕ СВЕЖЕЕ: старое видео
 * почти наверняка снято под другой патч и другие пороги.
 *
 * Никогда не бросает: сломанный YouTube не должен ронять страницу квеста.
 */
export async function getGunsmithVideos(): Promise<Map<number, GunsmithVideo>> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const out = new Map<number, GunsmithVideo>();

  if (!apiKey) return out;

  try {
    const items: RawItem[] = [];
    let token: string | undefined;

    // 51 видео → две страницы. Больше двух не крутим: защита от бесконечного цикла.
    for (let page = 0; page < 3; page++) {
      const res = await fetchPage(apiKey, token);
      items.push(...res.items);
      if (!res.next) break;
      token = res.next;
    }

    for (const it of items) {
      const s = it.snippet;
      const videoId = s?.resourceId?.videoId;
      const title = s?.title;
      if (!videoId || !title) continue;

      // Удалённые/приватные видео YouTube отдаёт с этими заголовками.
      if (title === "Deleted video" || title === "Private video") continue;

      const part = partFromTitle(title);
      if (part === null) continue;

      const publishedAt = s?.publishedAt ?? "";
      const existing = out.get(part);
      if (existing && existing.publishedAt >= publishedAt) continue; // оставляем свежее

      out.set(part, {
        videoId,
        title,
        publishedAt,
        thumbnailUrl:
          s?.thumbnails?.medium?.url ??
          s?.thumbnails?.high?.url ??
          s?.thumbnails?.default?.url ??
          "",
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }
  } catch (e) {
    // Видео — бонус. Квота кончилась или ключ протух → страница работает без него.
    console.warn("[gunsmith-videos]", e instanceof Error ? e.message : e);
  }

  return out;
}

/** Видео для конкретной части. null — для этой части гайда нет. */
export async function getGunsmithVideo(part: number | null): Promise<GunsmithVideo | null> {
  if (part === null) return null;
  const map = await getGunsmithVideos();
  return map.get(part) ?? null;
}