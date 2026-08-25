import { NextResponse } from 'next/server';
import type { ProfileOcrResult } from '@/types/profile-ocr';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Картинка идёт в платный Gemini → жёсткие лимиты против cost-абьюза.
const MAX_OCR_BODY = 8 * 1024 * 1024; // тело запроса ≤ 8 МБ (base64 раздувает ~×1.33)
const MAX_OCR_B64 = 6_000_000; // ≈ 4.5 МБ декодированного изображения

// Сигнатура реального изображения (magic-byte) — не доверяем клиентскому mimeType.
function magicMatches(base64: string, mimeType: string): boolean {
  const head = Buffer.from(base64.slice(0, 16), 'base64');
  if (head.length < 12) return false;
  if (mimeType === 'image/png') return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  if (mimeType === 'image/jpeg') return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (mimeType === 'image/webp') return head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

// Авторизация: OCR шлёт картинку в платный Gemini — пускаем ТОЛЬКО залогиненных
// (защита от спама = счёт). Пользователь берётся из сессии Supabase.
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Допустимые типы изображения (валидируем перед отправкой в модель).
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

// Распознавание профиля игрока EFT со скриншота через Google Gemini (REST, без SDK).
// Активируется переменной окружения GEMINI_API_KEY (.env.local). Ключ — только на сервере.
//
// Модель: мультимодальная flash со structured output. При смене линейки Google —
// поменять одну строку ниже (например на более новую flash-модель).
const GEMINI_MODEL = process.env.GEMINI_VISION_MODEL ?? 'gemini-3.6-flash';
// Egress-фикс (§4.11): бьём в Cloudflare Worker-прокси, не напрямую в googleapis.
// Прокси пробрасывает только заголовок x-goog-api-key (query ?key= не поддерживается).
const geminiUrl = (base: string, model: string) =>
  `${base}/v1beta/models/${model}:generateContent`;

// Жёсткая схема ответа (Gemini structured output) — модель физически не вернёт мусор.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nickname: { type: 'STRING', nullable: true },
    level: { type: 'INTEGER', nullable: true },
    prestige: { type: 'INTEGER', nullable: true },
    edition: { type: 'STRING', enum: ['Standard', 'LB', 'PFE', 'EOD', 'TUE'], nullable: true },
    faction: { type: 'STRING', enum: ['USEC', 'BEAR'], nullable: true },
    mode: { type: 'STRING', enum: ['PVP', 'PVE'], nullable: true },
    hoursPlayed: { type: 'INTEGER', nullable: true },
    raids: { type: 'INTEGER', nullable: true },
    survivalRate: { type: 'NUMBER', nullable: true },
  },
  required: ['nickname', 'level', 'prestige', 'edition', 'faction', 'mode', 'hoursPlayed', 'raids', 'survivalRate'],
};

const PROMPT = `Распознай профиль игрока Escape from Tarkov со скриншота экрана персонажа и верни JSON по схеме.
Поля:
- nickname: ник (ЧВК) игрока.
- level: уровень 1–99 (число) или null.
- prestige: престиж 0–6 (число) или null.
- edition: издание игры по бейджу/иконке — Standard, LB (Left Behind), PFE (Prepare for Escape), EOD (Edge of Darkness) или TUE (The Unheard) — или null.
- faction: фракция по логотипу — USEC или BEAR — или null.
- mode: режим — PVP или PVE — или null.
- hoursPlayed: суммарные часы в игре (число) или null.
- raids: суммарное число рейдов (число) или null.
- survivalRate: процент выживаемости (число 0–100) или null.
Если поле не видно или ты не уверен — верни null. Ничего не выдумывай.`;

export async function POST(req: Request) {
  // Гейт авторизации — раньше эндпоинт был открыт (любой спамил платный Gemini).
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  }

  // Per-user rate-limit — платный Gemini, ключ по userId (IP легко крутить).
  if (!(await rateLimit(`ocr:uid:${userId}`, 10, 3600))) {
    return NextResponse.json({ error: 'Слишком много запросов. Попробуйте позже.' }, { status: 429 });
  }
  // Ранний отсев переразмерного тела до буферизации/парсинга.
  const declaredLen = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLen) && declaredLen > MAX_OCR_BODY) {
    return NextResponse.json({ error: 'Изображение слишком большое' }, { status: 413 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Распознавание не настроено: задайте GEMINI_API_KEY в .env.local' },
      { status: 503 },
    );
  }

  const proxyBase = process.env.GEMINI_PROXY_BASE;
  if (!proxyBase) {
    return NextResponse.json(
      { error: 'Распознавание не настроено: задайте GEMINI_PROXY_BASE в .env.local' },
      { status: 503 },
    );
  }

  let body: { image?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }

  const { image, mimeType = 'image/png' } = body;
  if (!image) {
    return NextResponse.json({ error: 'Нет изображения' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ error: 'Неподдерживаемый тип изображения' }, { status: 400 });
  }
  // Принимаем и data-URL, и «голый» base64.
  const base64 = image.includes(',') ? image.slice(image.indexOf(',') + 1) : image;
  if (base64.length > MAX_OCR_B64) {
    return NextResponse.json({ error: 'Изображение слишком большое' }, { status: 413 });
  }
  // Сверяем реальные байты с заявленным типом — иначе мусорный payload жрёт токены Gemini.
  if (!magicMatches(base64, mimeType)) {
    return NextResponse.json({ error: 'Файл не является корректным изображением' }, { status: 422 });
  }

  try {
    const res = await fetch(geminiUrl(proxyBase, GEMINI_MODEL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!res.ok) {
      console.error('profile-ocr: Gemini вернул', res.status, await res.text());
      return NextResponse.json({ error: 'Ошибка распознавания' }, { status: 502 });
    }

    const json = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return NextResponse.json({ error: 'Пустой ответ модели' }, { status: 502 });
    }

    const data = JSON.parse(text) as ProfileOcrResult;
    return NextResponse.json({ data });
  } catch (err) {
    console.error('profile-ocr: ошибка', err);
    return NextResponse.json({ error: 'Ошибка распознавания' }, { status: 500 });
  }
}
