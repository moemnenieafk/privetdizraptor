// cta-mapper · S4 (vision → typeKey) и S6 (генерация канона). Серверный модуль.
//
// Решения: 5 — генерация ТОЛЬКО gemini-3-pro-image, typeKey — gemini-2.5-flash;
// 3 — промт от СЛОВ (subject + пропорция-число) + анкер, кроп лишь как фолбэк-геометрия;
// 4b — PALETTE = материальные триады, модель применяет одну триаду по материалу.
// SDK нет — сырой REST (образцы: src/app/api/profile-ocr, scripts/gemini-upscale-icon.mjs).
//
// Отказоустойчивость: 429 по биллингу (free_tier limit 0 / prepay depleted) → GeminiBillingError
// с внятным текстом, S6 не крешит (обкатка 2026-08-13 показала — ключ требует биллинга).

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { MaterialFamily, Matte } from './types';
import { OUTLINE_HEX, FACTORY_PALETTE } from './palette';

// gemini-2.5-flash снята Google → vision-модель актуализирована на gemini-3.6-flash (env-override).
export const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL ?? 'gemini-3.6-flash';
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3-pro-image';

// Запросы идут через наш Cloudflare Worker-прокси (обход регионального egress-блока Gemini):
// база — GEMINI_PROXY_BASE, ключ уходит заголовком x-goog-api-key, а не query ?key=.
export class GeminiBillingError extends Error {}
export class GeminiError extends Error {}

function proxyBase(): string {
  const b = process.env.GEMINI_PROXY_BASE;
  if (!b) throw new GeminiError('GEMINI_PROXY_BASE не задан (.env.local) — нужен Worker-прокси Gemini');
  return b.replace(/\/+$/, '');
}

const ENDPOINT = (model: string) =>
  `${proxyBase()}/v1beta/models/${model}:generateContent`;

function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new GeminiError('GEMINI_API_KEY не задан (.env.local)');
  return k;
}

interface GeminiPart {
  text?: string;
  inlineData?: { data: string; mimeType?: string };
  inline_data?: { data: string; mime_type?: string };
}

async function callGemini(model: string, body: unknown): Promise<GeminiPart[]> {
  const res = await fetch(ENDPOINT(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg: string = json?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429 || /free_tier|prepayment|billing|RESOURCE_EXHAUSTED/i.test(msg)) {
      throw new GeminiBillingError(
        `Gemini требует биллинг: ${msg.slice(0, 160)}. Включите биллинг и пополните баланс в ai.studio/projects.`,
      );
    }
    throw new GeminiError(msg.slice(0, 300));
  }
  return json?.candidates?.[0]?.content?.parts ?? [];
}

// ── S4: vision → typeKey/material/subjectSeed/isClutter ────────────────────────

export interface VisionResult {
  typeKey: string;
  material: string;
  subjectSeed: string;
  isClutter: boolean;
}

const VISION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    typeKey: { type: 'STRING' }, // семантический тип: 'shipping-container','hatchback-car','tank-cistern'…
    material: { type: 'STRING', enum: FACTORY_PALETTE.map((f) => f.id) },
    subjectSeed: { type: 'STRING' },
    isClutter: { type: 'BOOLEAN' }, // бочки/покрышки/растительность/мусор < 4.5 м
  },
  required: ['typeKey', 'material', 'subjectSeed', 'isClutter'],
};

const VISION_PROMPT = `Ты классифицируешь один вырезанный объект с игровой карты сверху. Верни JSON по схеме:
- typeKey: короткий kebab-case семантический тип (одинаковый для всех экземпляров одного вида: shipping-container, hatchback-car, box-van, tank-cistern, covered-wagon, flat-wagon, tower-crane…).
- material: ближайшее материальное семейство из перечисления.
- subjectSeed: короткое описание формы и частей обычным языком, без марок и названий из игры.
- isClutter: true для мелочи-мусора (бочки, покрышки, ящики, поддоны, растительность, камни-осыпь) — того, что не векторизуется как объект.`;

export async function visionType(cropPng: Buffer): Promise<VisionResult> {
  const parts = await callGemini(GEMINI_VISION_MODEL, {
    contents: [{ parts: [{ inline_data: { mime_type: 'image/png', data: cropPng.toString('base64') } }, { text: VISION_PROMPT }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: VISION_SCHEMA },
  });
  const text = parts.find((p) => p.text)?.text;
  if (!text) throw new GeminiError('vision: пустой ответ');
  return JSON.parse(text) as VisionResult;
}

// ── S6: генерация канона (Pro, 4K) ─────────────────────────────────────────────

export interface GenerateArgs {
  subject: string; // финальный гипер-конкретный subject (S5)
  materials: MaterialFamily[]; // триады, которыми модель красит
  matte: Matte;
  orientation?: string; // канон: длинная ось горизонтально
  anchorPng?: Buffer; // стиль-анкер (со 2-го объекта обязателен)
  geometryPng?: Buffer; // фолбэк-геометрия (16К-кроп) — только для непроизводных пропорций
  cacheDir: string; // map-exports/mapper/<mapId>/cache
}

/** Промт TYPE A (материальные триады). Байт-в-байт фиксированные блоки — не переписывать «для разнообразия». */
export function buildPrompt(a: Omit<GenerateArgs, 'cacheDir'>): string {
  const palette = a.materials
    .map((f) => `${f.shadow}, ${f.default}, ${f.highlight} for ${f.usage} as shadow / base / highlight`)
    .join('; ');
  const refBlock = [
    a.geometryPng
      ? 'REFERENCE: the GEOMETRY SOURCE image reproduces the silhouette, proportions and rotation only — a shape guide, do NOT copy its colours, lighting or rendering.'
      : '',
    a.anchorPng
      ? 'STYLE ANCHOR: match the anchor image exactly — its outline weight, fill flatness, number of shading steps and contrast. Only the depicted object differs.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'Redraw the object as a flat vector map asset for a top-down game map: solid flat colour areas with hard edges only.',
    refBlock,
    `SUBJECT: ${a.subject}`,
    'CAMERA: orthographic, straight down, camera axis perpendicular to the ground. Only horizontal surfaces are visible. Parallel edges stay parallel.',
    'STEP 1 — MASSES. Block the object as flat solid shapes, one uniform colour per part, each bounded by a hard edge.',
    'STEP 2 — SHADING. Each material gets exactly its three named tones: base, shadow, highlight. Each tone is one solid area with a hard boundary. Light from the upper left.',
    'STEP 3 — LINEWORK. A dark outline of constant weight around the outer silhouette and each major part; identical everywhere, never tapering.',
    'STEP 4 — REPEATED STRUCTURE. Ribbing, seams, planking as clean repeated parallel shapes at even spacing.',
    'STEP 5 — DETAIL BUDGET. Keep every part at least 1/40 of the image width; anything smaller merges into the flat colour of its parent.',
    `PALETTE: ${palette}; ${OUTLINE_HEX} for the outline. Every area is exactly one of these colours, assigned by material.`,
    `FRAME: one object, centred, oriented ${a.orientation ?? 'with its long axis horizontal'}, even ~5% margin on all sides, empty corners.`,
    `BACKGROUND: a single flat ${a.matte === 'magenta' ? 'saturated magenta (#C000C0)' : 'saturated green (#00C000)'} field, uniform edge to edge. The object meets it only at its outline and casts nothing onto it.`,
    'Reads as a printed vector illustration: flat inks, hard edges. No perspective, no isometric, no tilt, no gradient, no soft shadow, no gloss, no bloom, no noise, no texture, no drop shadow, no border, no lettering.',
    '4K output, 1:1 aspect ratio.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Генерация канона с кэшом по sha1(prompt + geometry). Повторный прогон не тарифицируется. */
export async function generateCanonical(a: GenerateArgs): Promise<{ png: Buffer; cached: boolean; promptHash: string }> {
  const prompt = buildPrompt(a);
  const hash = createHash('sha1')
    .update(prompt)
    .update(a.geometryPng ?? Buffer.alloc(0))
    .digest('hex')
    .slice(0, 16);
  const cachePath = join(a.cacheDir, `${hash}.png`);
  if (existsSync(cachePath)) return { png: await readFile(cachePath), cached: true, promptHash: hash };

  const parts: GeminiPart[] = [{ text: prompt }];
  if (a.geometryPng) parts.push({ inline_data: { mime_type: 'image/png', data: a.geometryPng.toString('base64') } });
  if (a.anchorPng) parts.push({ inline_data: { mime_type: 'image/png', data: a.anchorPng.toString('base64') } });

  const out = await callGemini(GEMINI_IMAGE_MODEL, {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['Image'] },
  });
  const img = out.find((p) => p.inlineData || p.inline_data);
  const data = (img?.inlineData || img?.inline_data)?.data;
  if (!data) throw new GeminiError('generate: картинки в ответе нет');
  const png = Buffer.from(data, 'base64');
  await mkdir(a.cacheDir, { recursive: true });
  await writeFile(cachePath, png);
  return { png, cached: false, promptHash: hash };
}
