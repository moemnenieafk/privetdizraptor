import { NextResponse } from 'next/server';
import type { ProfileOcrResult } from '@/types/profile-ocr';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

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
const GEMINI_MODEL = 'gemini-2.5-flash';
const geminiUrl = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

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
  },
  required: ['nickname', 'level', 'prestige', 'edition', 'faction', 'mode'],
};

const PROMPT = `Распознай профиль игрока Escape from Tarkov со скриншота экрана персонажа и верни JSON по схеме.
Поля:
- nickname: ник (ЧВК) игрока.
- level: уровень 1–99 (число) или null.
- prestige: престиж 0–6 (число) или null.
- edition: издание игры по бейджу/иконке — Standard, LB (Left Behind), PFE (Prepare for Escape), EOD (Edge of Darkness) или TUE (The Unheard) — или null.
- faction: фракция по логотипу — USEC или BEAR — или null.
- mode: режим — PVP или PVE — или null.
Если поле не видно или ты не уверен — верни null. Ничего не выдумывай.`;

export async function POST(req: Request) {
  // Гейт авторизации — раньше эндпоинт был открыт (любой спамил платный Gemini).
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Распознавание не настроено: задайте GEMINI_API_KEY в .env.local' },
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

  try {
    const res = await fetch(geminiUrl(GEMINI_MODEL, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
