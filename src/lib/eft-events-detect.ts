// Детект новых внутриигровых событий EFT для раздела «События» (src/data/eft-events.ts).
//
// Раздел — РУЧНАЯ редакторская хроника (нет структурированного фида в нашем формате), поэтому
// авто-запись невозможна. Здесь — только ДЕТЕКТ + ПИНГ: сравниваем самое свежее записанное
// событие с новостями BSG из ДВУХ источников и, если BSG постил что-то новее, шлём в Telegram
// напоминание «раздел мог устареть».
//
// Источники (оба best-effort — сбой одного не роняет детект):
//   • Steam News API — чистый JSON, надёжно (тот же, что патчноуты, steam-news.ts).
//   • Офиц. Telegram-канал BSG — парсинг t.me/s/ (хрупко, bsg-telegram.ts). Русский, часто раньше.
//
// Автономность (§4.11): вызывается ТОЛЬКО из крон-роута /api/cron/detect-events. В рантайме
// страниц/компонентов не дёргается.

import { EFT_EVENTS } from '@/data/eft-events';
import { getSteamPatchNotes } from '@/lib/steam-news';
import { getBsgTelegramPosts } from '@/lib/bsg-telegram';

/** Признаки «похоже на ивент» в заголовке/выжимке — для пометки ⚑ и триггера пинга. */
const EVENT_HINTS =
  /(event|событ|ивент|season|сезон|wipe|вайп|halloween|хэллоуин|christmas|рождеств|новогодн|new year|праздн|winter|зимн|boss|босс|cultist|сектант|spawn|спавн|100\s?%|collab|коллаб|holiday|anniversary|годовщин|labyrinth|лабиринт)/i;

type Source = 'steam' | 'telegram';

interface NewsItem {
  title: string;
  url: string;
  excerpt: string;
  publishedAt: Date;
  source: Source;
}

export interface EventCandidate {
  title: string;
  url: string;
  source: Source;
  /** ISO-дата публикации новости. */
  publishedAt: string;
  /** Заголовок/выжимка похожи на анонс ивента (эвристика, для приоритизации). */
  looksLikeEvent: boolean;
}

export interface DetectResult {
  newestLoggedEvent: { title: string; date: string } | null;
  /** Что реально удалось опросить (для диагностики хрупкого TG-источника). */
  sources: { steam: boolean; telegram: boolean };
  /** Новости BSG свежее последнего записанного события — что стоит просмотреть. */
  candidates: EventCandidate[];
  /** Отправлен ли пинг (false, если Telegram не настроен или пинговать нечего). */
  notified: boolean;
}

/** Самое свежее записанное событие (по дате, не полагаясь на порядок массива). */
function newestLoggedEvent(): { title: string; date: string } | null {
  let newest: { title: string; date: string } | null = null;
  for (const e of EFT_EVENTS) {
    if (!newest || e.date > newest.date) newest = { title: e.title, date: e.date };
  }
  return newest;
}

export async function detectNewEvents(): Promise<DetectResult> {
  const newest = newestLoggedEvent();
  const cutoff = newest?.date ?? '0000-00-00'; // ISO YYYY-MM-DD → лексикографическое сравнение корректно.

  // Оба источника best-effort: сбой (особенно хрупкого TG-парсинга) не роняет детект.
  const [steam, telegram] = await Promise.all([
    getSteamPatchNotes(20).catch((e) => {
      console.error('[detect-events] steam:', e);
      return null;
    }),
    getBsgTelegramPosts(20).catch((e) => {
      console.error('[detect-events] telegram:', e);
      return null;
    }),
  ]);

  const all: NewsItem[] = [
    ...(steam ?? []).map((n) => ({ title: n.title, url: n.url, excerpt: n.excerpt, publishedAt: n.publishedAt, source: 'steam' as const })),
    ...(telegram ?? []).map((n) => ({ title: n.title, url: n.url, excerpt: n.excerpt, publishedAt: n.publishedAt, source: 'telegram' as const })),
  ];

  const candidates: EventCandidate[] = all
    .filter((n) => n.publishedAt.toISOString().slice(0, 10) > cutoff)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .map((n) => ({
      title: n.title,
      url: n.url,
      source: n.source,
      publishedAt: n.publishedAt.toISOString(),
      looksLikeEvent: EVENT_HINTS.test(`${n.title} ${n.excerpt}`),
    }));

  // Пингуем, только если среди свежих новостей есть похожая на ивент — чтобы не спамить
  // хотфиксами. Полный список всё равно уходит в JSON-ответ (ручная проверка эндпоинта).
  const hasEventLike = candidates.some((c) => c.looksLikeEvent);
  const notified = hasEventLike ? await pingTelegram(newest, candidates) : false;

  return {
    newestLoggedEvent: newest,
    sources: { steam: steam !== null, telegram: telegram !== null },
    candidates,
    notified,
  };
}

/** Пинг в Telegram (Bot API sendMessage). Нет токена/чата → тихо пропускаем (graceful). */
async function pingTelegram(
  newest: { title: string; date: string } | null,
  candidates: EventCandidate[],
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const lines = candidates.map(
    (c) => `• ${c.looksLikeEvent ? '⚑ ' : ''}[${c.source}] ${c.title} — ${c.publishedAt.slice(0, 10)}\n${c.url}`,
  );
  const text = [
    '🗓️ EFT — раздел «События» мог устареть.',
    newest ? `Последнее записанное: «${newest.title}» (${newest.date}).` : 'В файле событий пусто.',
    `Новости BSG после неё (${candidates.length}, ⚑ — похоже на ивент):`,
    ...lines,
    '→ Добавь актуальное в src/data/eft-events.ts (или попроси Клода).',
  ].join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000), // Telegram cap = 4096.
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false; // Пинг — best-effort: сбой Telegram не должен ронять крон.
  }
}
