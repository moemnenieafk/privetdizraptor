// Официальный Telegram-канал BSG как ДОПОЛНИТЕЛЬНЫЙ источник детекта событий EFT.
// Читаем публичный превью t.me/s/<channel> (без бота, без ключа). По умолчанию — русский
// канал (наш контент русский). Хендл переопределяется env BSG_TG_CHANNEL.
//
// ⚠️ Это ПАРСИНГ HTML — хрупко (разметка t.me может тихо поменяться). Поэтому источник
// best-effort: при сбое детект-крон продолжает работать на Steam News (см. eft-events-detect.ts).
// Полный текст не храним — заголовок + выжимка (≤400) + ссылка на пост; контент BSG остаётся у BSG.

const BSG_TG_CHANNEL = process.env.BSG_TG_CHANNEL || 'escapefromtarkovRU';

export interface TgPost {
  title: string;
  url: string;
  excerpt: string;
  publishedAt: Date;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

const CAP = 400;

/** Свежие посты канала BSG. Бросает при сетевом сбое — вызывающий ловит и деградирует на Steam. */
export async function getBsgTelegramPosts(limit = 20): Promise<TgPost[]> {
  const res = await fetch(`https://t.me/s/${BSG_TG_CHANNEL}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; CTA-EventsBot/1.0)' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`t.me/s/${BSG_TG_CHANNEL} → ${res.status}`);
  const html = await res.text();

  const seen = new Set<string>();
  const posts: TgPost[] = [];
  // Режем по началу каждого сообщения (data-post) и парсим поля внутри окна — так time/text
  // не разъезжаются по индексам (у поста-картинки текста может не быть).
  for (const chunk of html.split(/(?=data-post=")/g)) {
    const post = chunk.match(/^data-post="([^"]+)"/)?.[1];
    if (!post || seen.has(post)) continue;
    const datetime = chunk.match(/<time[^>]*datetime="([^"]+)"/)?.[1];
    const textRaw =
      chunk.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>\s*<div class="tgme_widget_message_footer/)?.[1] ??
      chunk.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)?.[1];
    if (!datetime || !textRaw) continue;
    const text = stripTags(textRaw);
    if (!text) continue;
    const ts = new Date(datetime);
    if (Number.isNaN(ts.getTime())) continue;
    seen.add(post);
    posts.push({
      title: text.length > 90 ? `${text.slice(0, 90).trimEnd()}…` : text,
      url: `https://t.me/${post}`,
      excerpt: text.length > CAP ? `${text.slice(0, CAP).trimEnd()}…` : text,
      publishedAt: ts,
    });
  }
  // t.me/s отдаёт по возрастанию времени — свежие в хвосте.
  return posts.slice(-limit);
}
