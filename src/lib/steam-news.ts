// Патчноуты EFT из Steam News API (appid 3932890). Официально, без ключа, стабильно.
//
// Почему не Discord (канал патчей на сервере BSG): читать чужой сервер можно только
// ботом, приглашённым в него. Нас туда никто не пустит.
// Почему не парсинг escapefromtarkov.com: разметка меняется, поломается молча.
//
// ВАЖНО: полный текст патчноута НЕ сохраняем — берём выжимку (≤400 символов) и ссылку
// на первоисточник. Контент BSG остаётся у BSG.
const APPID = 3932890;
const API = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/";

export interface SteamNewsItem {
  /** gid — уникальный id новости в Steam, ключ дедупликации. */
  gid: string;
  title: string;
  url: string;
  /** Выжимка без BBCode. */
  excerpt: string;
  publishedAt: Date;
  author: string;
}

interface RawItem {
  gid?: string;
  title?: string;
  url?: string;
  contents?: string;
  author?: string;
  date?: number;
  feedname?: string;
}

interface RawResponse {
  appnews?: { newsitems?: RawItem[] };
}

/**
 * Steam отдаёт contents в BBCode ([h3], [list], [*], [img]{STEAM_CLAN_IMAGE}/…).
 * Чистим до простого текста: теги долой, картинки долой, пробелы схлопнуть.
 */
function stripBBCode(raw: string): string {
  return raw
    .replace(/\[img\][^[]*\[\/img\]/gi, " ")
    .replace(/\{STEAM_CLAN_IMAGE\}\S*/gi, " ")
    .replace(/\[\/?[^\]]+\]/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const EXCERPT_CAP = 400;

/** Последние новости игры из Steam. Бросает при пустом/битом ответе — синк должен упасть. */
export async function getSteamPatchNotes(count = 20): Promise<SteamNewsItem[]> {
  const url = new URL(API);
  url.searchParams.set("appid", String(APPID));
  url.searchParams.set("count", String(count));
  // maxlength=0 → полный текст: нам нужен он ТОЛЬКО чтобы сделать честную выжимку,
  // в БД полный текст не уезжает.
  url.searchParams.set("maxlength", "0");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Steam News → ${res.status}`);

  const json = (await res.json()) as RawResponse;
  const items = json.appnews?.newsitems ?? [];
  if (items.length === 0) throw new Error("Steam News отдал пустой список");

  const out: SteamNewsItem[] = [];

  for (const it of items) {
    if (!it.gid || !it.title || !it.url || typeof it.date !== "number") continue;

    const clean = stripBBCode(it.contents ?? "");
    const excerpt =
      clean.length > EXCERPT_CAP ? `${clean.slice(0, EXCERPT_CAP).trimEnd()}…` : clean;

    out.push({
      gid: it.gid,
      title: it.title.trim(),
      url: it.url,
      excerpt,
      publishedAt: new Date(it.date * 1000),
      author: it.author?.trim() || "Battlestate Games",
    });
  }

  return out;
}

/** Слаг из заголовка: «Patch 1.0.6.0» → «patch-1-0-6-0». */
export function patchSlug(title: string, gid: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length > 0 ? base : `patch-${gid}`;
}
