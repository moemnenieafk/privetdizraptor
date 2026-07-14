// Снэпшот сборки в ссылке. Никакой БД: всё дерево кодируется прямо в URL, поэтому
// поделиться можно с любого тира и без регистрации — друг открывает и видит ту же
// сборку, статы, уклон и актуальную цену (цены подтянутся СВЕЖИЕ, на момент открытия).
//
// Формат: "1" + base64url(JSON) — версия первым символом, чтобы старые ссылки не
// ломались, когда схема изменится.
//
// Компактная форма узла: [itemId] либо [itemId, [[slotNameId, узел], ...]].
// quantity не храним — в конструкторе он всегда 1.
import type { BuildNode } from '@/lib/weapon-build';

const VERSION = '1';

/** Потолки против «ссылки-бомбы»: 60 узлов, глубина 8, 4000 символов кода. */
const MAX_NODES = 60;
const MAX_DEPTH = 8;
const MAX_CODE = 4000;

type EncNode = [string] | [string, [string, EncNode][]];

/* ───────────────── base64url (работает и на клиенте, и на сервере) ───────────────── */

function toB64Url(s: string): string {
  const b64 =
    typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): string | null {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  try {
    return typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  } catch {
    return null;
  }
}

/* ───────────────── кодирование ───────────────── */

function enc(node: BuildNode): EncNode {
  const entries = Object.entries(node.mods);
  if (entries.length === 0) return [node.itemId];
  return [
    node.itemId,
    entries.map(([slot, child]) => [slot, enc(child)] as [string, EncNode]),
  ];
}

/** Дерево → код для URL. Идентификаторы и nameId слотов — ASCII, так что base64 безопасен. */
export function encodeBuild(node: BuildNode): string {
  return VERSION + toB64Url(JSON.stringify(enc(node)));
}

/* ───────────────── декодирование ───────────────── */

function isEncNode(v: unknown, depth: number, counter: { n: number }): v is EncNode {
  if (depth > MAX_DEPTH) return false;
  if (!Array.isArray(v) || v.length === 0 || v.length > 2) return false;
  if (typeof v[0] !== 'string' || v[0].length === 0 || v[0].length > 40) return false;

  counter.n++;
  if (counter.n > MAX_NODES) return false;

  if (v.length === 1) return true;

  const entries = v[1];
  if (!Array.isArray(entries)) return false;

  for (const e of entries) {
    if (!Array.isArray(e) || e.length !== 2) return false;
    if (typeof e[0] !== 'string' || e[0].length === 0 || e[0].length > 60) return false;
    if (!isEncNode(e[1], depth + 1, counter)) return false;
  }
  return true;
}

function dec(e: EncNode): BuildNode {
  const [itemId, entries] = e;
  const mods: Record<string, BuildNode> = {};
  for (const [slot, child] of entries ?? []) mods[slot] = dec(child);
  return { itemId, quantity: 1, mods };
}

/** Код из URL → дерево. null на любой некорректный вход: страница отдаст 404, а не упадёт. */
export function decodeBuild(code: string): BuildNode | null {
  if (!code || code.length > MAX_CODE) return null;
  if (code[0] !== VERSION) return null;

  const json = fromB64Url(code.slice(1));
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!isEncNode(parsed, 0, { n: 0 })) return null;
  return dec(parsed);
}

/* ───────────────── ссылка ───────────────── */

/** Путь снэпшота. Имя — в query: в код его не пихаем, чтобы кириллица не раздувала base64. */
export function buildSharePath(node: BuildNode, name?: string): string {
  const code = encodeBuild(node);
  const base = `/eft/progress/loadouts/b/${code}`;
  const clean = name?.trim().slice(0, 60);
  return clean ? `${base}?n=${encodeURIComponent(clean)}` : base;
}

/** Абсолютная ссылка для «поделиться». origin берём из window или NEXT_PUBLIC_SITE_URL. */
export function buildShareUrl(origin: string, node: BuildNode, name?: string): string {
  return `${origin.replace(/\/$/, '')}${buildSharePath(node, name)}`;
}
