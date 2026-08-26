---
title: Код - gemini
tags: [cta, vision, code, typescript]
status: parsed-clean
repo_path: src/lib/vision/gemini.ts
lines: 111
created: 2026-08-24
---

# `src/lib/vision/gemini.ts`

Батч-запрос к Gemini: N слотов одним вызовом, structured output через `responseSchema`, жёсткая валидация — вердикт принимается только если `itemId` есть в списке кандидатов этого слота.

- [[Механика распознавания инвентаря]]

```typescript
import type { ItemCandidate } from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type VisionRequestSlot = {
  slotIndex: number;
  png: Buffer;
  candidates: ItemCandidate[];
};

export type VisionVerdict = {
  slotIndex: number;
  itemId: string | null;
  confidence: number;
};

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      slotIndex: { type: 'INTEGER' },
      itemId: { type: 'STRING', nullable: true },
      confidence: { type: 'NUMBER' },
    },
    required: ['slotIndex', 'itemId', 'confidence'],
  },
} as const;

const SYSTEM_PROMPT = [
  'Ты классифицируешь иконки предметов из Escape from Tarkov.',
  'Для каждого изображения дан закрытый список кандидатов с их itemId.',
  'Выбери ровно один itemId из списка кандидатов для этого слота.',
  'Если ни один кандидат не подходит, верни itemId = null.',
  'Никогда не придумывай itemId, которого нет в списке.',
  'confidence — число от 0 до 1.',
].join(' ');

/** Батч одним запросом: N слотов по одному вызову, а не N вызовов. */
export async function resolveSlots(slots: VisionRequestSlot[]): Promise<VisionVerdict[]> {
  if (slots.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  const model = process.env.GEMINI_VISION_MODEL;
  if (!model) throw new Error('GEMINI_VISION_MODEL is not configured');

  const parts: GeminiPart[] = [];
  for (const slot of slots) {
    const list = slot.candidates
      .map((c) => `${c.itemId} = ${c.name} (dist ${c.distance})`)
      .join('; ');
    parts.push({ text: `slotIndex ${slot.slotIndex}. Кандидаты: ${list}` });
    parts.push({
      inline_data: { mime_type: 'image/png', data: slot.png.toString('base64') },
    });
  }

  const response = await fetch(`${API_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  const payload = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Gemini responded ${response.status}`);
  }

  const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  const allowed = new Map(slots.map((s) => [s.slotIndex, new Set(s.candidates.map((c) => c.itemId))]));
  const verdicts: VisionVerdict[] = [];

  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const slotIndex = record.slotIndex;
    const itemId = record.itemId;
    const confidence = record.confidence;
    if (typeof slotIndex !== 'number') continue;

    // модель обязана выбирать из списка — всё остальное отбрасываем
    const valid = typeof itemId === 'string' && allowed.get(slotIndex)?.has(itemId) === true;
    verdicts.push({
      slotIndex,
      itemId: valid ? (itemId as string) : null,
      confidence: typeof confidence === 'number' ? confidence : 0,
    });
  }
  return verdicts;
}
```

---

Сырой файл: `_src/src/lib/vision/gemini.ts`. Копируется в репозиторий по пути `src/lib/vision/gemini.ts`.
