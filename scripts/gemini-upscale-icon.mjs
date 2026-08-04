// scripts/gemini-upscale-icon.mjs
// Апскейл плоской иконки-эмблемы достижения через Gemini image-модель (nano-banana).
// Источник 98x112 — авторский потолок BSG; тут повышаем ЭКРАННОЕ качество ресинтезом.
//
//   node scripts/gemini-upscale-icon.mjs --in=<png> --out=<png> [--model=gemini-3-pro-image]
//
// Ключ: GEMINI_API_KEY (env или .env.local). Значение не печатаем.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const val = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('GEMINI_API_KEY не найден');
}

const MODEL = val('model', 'gemini-3-pro-image');
const IN = val('in');
const OUT = val('out');
const PROMPT = val('prompt',
  'Recreate this small game achievement emblem at high resolution with clean, crisp, smooth vector-like edges. ' +
  'CRITICAL: preserve the EXACT same symbol, silhouette, internal details, colors and metallic gradients — ' +
  'do NOT add, remove, redesign or reinterpret any element; keep identical proportions and centered composition. ' +
  'Output on a FULLY TRANSPARENT background (alpha channel), no added background, no frame, no shadow, no text, no border. ' +
  'Same emblem — just sharper and higher resolution.');

if (!IN || !OUT) { console.error('нужны --in и --out'); process.exit(2); }

const buf = await readFile(IN);
const body = {
  contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/png', data: buf.toString('base64') } }] }],
  generationConfig: { responseModalities: ['Image'] },
};

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey()}`;
const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const json = await res.json();

if (!res.ok || json.error) { console.error('API error:', JSON.stringify(json.error || json).slice(0, 500)); process.exit(1); }

const parts = json.candidates?.[0]?.content?.parts || [];
const imgPart = parts.find(p => p.inlineData || p.inline_data);
const textPart = parts.find(p => p.text);
if (textPart) console.log('модель сказала:', textPart.text.slice(0, 300));
if (!imgPart) { console.error('картинки в ответе нет. finishReason:', json.candidates?.[0]?.finishReason); process.exit(1); }

const data = (imgPart.inlineData || imgPart.inline_data).data;
await writeFile(OUT, Buffer.from(data, 'base64'));
console.log('✓ сохранено:', OUT, `(${(Buffer.from(data, 'base64').length / 1024).toFixed(1)}KB)`);
