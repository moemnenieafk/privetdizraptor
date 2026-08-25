import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { generateImage, GeminiBillingError } from '@/lib/ai/gemini-image';

export const runtime = 'nodejs';

// Генерация картинки идёт в платный Gemini → жёсткие лимиты против cost-абьюза.
const MAX_IMAGE_B64 = 8 * 1024 * 1024; // base64 входной картинки ≤ 8 МБ
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

// Пускаем ТОЛЬКО залогиненных (генерация платная — защита от спама = счёт).
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

interface ImageRequestBody {
  prompt?: string;
  image?: string;
  mimeType?: string;
}

export async function POST(req: Request) {
  // Гейт авторизации — платный Gemini, только вошедшие.
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  }

  // Per-user rate-limit — ключ по userId (IP легко крутить). ~10/час.
  if (!(await rateLimit(`ai-image:uid:${userId}`, 10, 3600))) {
    return NextResponse.json({ error: 'Слишком много запросов. Попробуйте позже.' }, { status: 429 });
  }

  let body: ImageRequestBody;
  try {
    body = (await req.json()) as ImageRequestBody;
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'Пустой промпт' }, { status: 400 });
  }

  // Опциональная входная картинка (режим редактирования).
  let inputImageBase64: string | undefined;
  let inputMime: string | undefined;
  if (body.image) {
    inputMime = body.mimeType ?? 'image/png';
    if (!ALLOWED_MIME.has(inputMime)) {
      return NextResponse.json({ error: 'Неподдерживаемый тип изображения' }, { status: 400 });
    }
    // Принимаем и data-URL, и «голый» base64.
    inputImageBase64 = body.image.includes(',') ? body.image.slice(body.image.indexOf(',') + 1) : body.image;
    if (inputImageBase64.length > MAX_IMAGE_B64) {
      return NextResponse.json({ error: 'Изображение слишком большое' }, { status: 413 });
    }
  }

  try {
    const { imageBase64, mimeType } = await generateImage({
      prompt,
      inputImageBase64,
      mimeType: inputMime,
    });
    return NextResponse.json({ image: `data:${mimeType};base64,${imageBase64}` });
  } catch (err) {
    // 429 prepay — не наш баг, а пустой счёт Gemini. Отдаём 402, чтобы фронт понял.
    if (err instanceof GeminiBillingError) {
      console.error('ai/image: Gemini billing', err.message);
      return NextResponse.json({ error: 'Gemini billing: пополните баланс' }, { status: 402 });
    }
    console.error('ai/image: ошибка', err);
    return NextResponse.json({ error: 'Ошибка генерации изображения' }, { status: 502 });
  }
}
