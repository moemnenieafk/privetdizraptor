// Интерпретатор «тихих изменений» BSG (источник: changes.tarkov-changes.com).
// Чистый модуль без внешних зависимостей: классифицирует diff серверного/клиентского
// конфига и даёт RU-подписи. Используется и синком (src/db/silent-changes.ts —
// относительный импорт под tsx), и панелью на game-updates. Аналог game-changes-format.ts.

export type SilentKind = "added" | "removed" | "field";
export type SilentClass = "economy" | "config" | "locale" | "other";

// 24-символьный BSG item id внутри ключа, напр. ['6a33c17933cff6b88c08902e Name'].
const BSG_ID = /\b([0-9a-f]{24})\b/i;

// Экономика: цены, курсы, торговцы, барахолка, страховка, ремонт.
const ECONOMY_HINTS = [
  "price", "cost", "currency", "ragfair", "flea", "trader", "loyal",
  "insur", "sell", "buy", "barter", "exchange", "tax", "commission",
  "discount", "repair", "fee", "coef",
];
const LOCALE_LEAF = /\b(name|shortname|description)\b/i;

/** BSG-id предмета из ключа (lowercase) или null. */
export function extractItemId(keyPath: string): string | null {
  const m = keyPath.match(BSG_ID);
  return m ? m[1].toLowerCase() : null;
}

/** Классифицирует изменение по файлу и пути ключа. */
export function classify(filePath: string, keyPath: string): SilentClass {
  const hay = `${filePath} ${keyPath}`.toLowerCase();
  if (ECONOMY_HINTS.some((h) => hay.includes(h))) return "economy";
  if (filePath.includes("/locale/") || LOCALE_LEAF.test(keyPath)) return "locale";
  if (filePath.includes("globals") || filePath.includes("config")) return "config";
  return "other";
}

export const CLASS_LABEL: Record<SilentClass, string> = {
  economy: "Экономика",
  config: "Конфиг",
  locale: "Локализация",
  other: "Прочее",
};

export function asSilentClass(v: string): SilentClass {
  return v === "economy" || v === "config" || v === "locale" ? v : "other";
}

export function asSilentKind(v: string): SilentKind {
  return v === "added" || v === "removed" ? v : "field";
}

/** Человекочитаемый заголовок ключа: убираем BSG-id, берём последний сегмент пути. */
export function keyLabel(keyPath: string): string {
  const noId = keyPath.replace(BSG_ID, "").trim();
  const segs = noId.split(".").map((s) => s.trim()).filter(Boolean);
  return segs[segs.length - 1] || noId || keyPath;
}

/** Родительский контекст пути (всё, кроме последнего сегмента) — для подписи-хлебной крошки. */
export function keyContext(keyPath: string): string | null {
  const noId = keyPath.replace(BSG_ID, "").trim();
  const segs = noId.split(".").map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== "data");
  return segs.length > 1 ? segs.slice(0, -1).join(" › ") : null;
}

export const fmtPulled = (iso: string): string =>
  new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
