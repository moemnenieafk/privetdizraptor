// Генерация/редактирование картинок через Google Gemini image-модель («Nano Banana»),
// проксируемую нашим Cloudflare Worker (§4.11 egress-фикс: бьём в Worker, не в googleapis).
// Прокси пробрасывает только заголовок x-goog-api-key (query ?key= не поддерживается).
//
// Модель — GEMINI_IMAGE_MODEL (.env.local). Подтверждённый id: gemini-3-pro-image
// (429 prepay через прокси = id валиден, биллинг пуст). При смене линейки Google —
// одна строка в .env.local.

// --- Размеченные типы ответа Gemini (без any) --------------------------------

interface GeminiInlineData {
  mimeType?: string;
  mime_type?: string;
  data?: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}

interface GeminiSuccess {
  candidates?: GeminiCandidate[];
}

interface GeminiError {
  error?: { code?: number; message?: string; status?: string };
}

// --- Публичные типы хелпера ---------------------------------------------------

export interface GenerateImageInput {
  prompt: string;
  /** base64 входной картинки (без data-URL префикса) — для редактирования. */
  inputImageBase64?: string;
  /** mime входной картинки, напр. 'image/png'. Обязателен, если есть inputImageBase64. */
  mimeType?: string;
}

export interface GenerateImageResult {
  imageBase64: string;
  mimeType: string;
}

/** Ошибка биллинга Gemini (429 prepay) — фронт отличает «пополни баланс» от нашего бага. */
export class GeminiBillingError extends Error {
  readonly kind = 'billing' as const;
  constructor(message: string) {
    super(message);
    this.name = 'GeminiBillingError';
  }
}

function pickInlineData(part: GeminiPart): GeminiInlineData | undefined {
  return part.inlineData ?? part.inline_data;
}

/**
 * Генерирует (или редактирует, если передан inputImageBase64) картинку.
 * Возвращает base64 картинки + её mime. Кидает GeminiBillingError на 429 prepay,
 * обычный Error — на прочие сбои.
 */
export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const { prompt, inputImageBase64, mimeType } = input;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY не задан');

  const proxyBase = process.env.GEMINI_PROXY_BASE;
  if (!proxyBase) throw new Error('GEMINI_PROXY_BASE не задан');

  const model = process.env.GEMINI_IMAGE_MODEL;
  if (!model) throw new Error('GEMINI_IMAGE_MODEL не задан');

  const parts: GeminiPart[] = [{ text: prompt }];
  if (inputImageBase64) {
    parts.push({ inline_data: { mime_type: mimeType ?? 'image/png', data: inputImageBase64 } });
  }

  const res = await fetch(`${proxyBase}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let parsed: GeminiError | null = null;
    try {
      parsed = JSON.parse(raw) as GeminiError;
    } catch {
      /* тело не JSON — оставим raw */
    }
    const message = parsed?.error?.message ?? raw;

    // 429 prepay — счёт пуст, инфраструктура исправна. Отдельный тип для фронта.
    if (res.status === 429) {
      throw new GeminiBillingError(message || 'Gemini: prepayment credits depleted');
    }
    throw new Error(`Gemini image ${res.status}: ${message}`);
  }

  const json = (await res.json()) as GeminiSuccess;
  const candidateParts = json.candidates?.[0]?.content?.parts ?? [];
  for (const part of candidateParts) {
    const inline = pickInlineData(part);
    if (inline?.data) {
      return { imageBase64: inline.data, mimeType: inline.mimeType ?? inline.mime_type ?? 'image/png' };
    }
  }

  throw new Error('Gemini image: в ответе нет картинки');
}
