// Типизированный клиент внутреннего CTA API (слой 3).
// Заменяет прямые обращения к api.tarkov.dev: данные идут из нашей Supabase.
//
// Работает и на сервере (RSC), и в браузере: на сервере self-fetch требует
// абсолютный URL, в браузере — относительный.
import type { ItemProperties } from "@/db/schema";

/* ───────────────── DTO (общая форма ответа API) ───────────────── */
export interface CtaEftItem {
  id: string; // 24-символьный BSG inGameId
  name: string;
  shortName: string | null;
  category: string | null; // slug категории
  weight: number | null;
  width: number | null;
  height: number | null;
  basePrice: number | null;
  image: string; // локальный путь /images/items/eft/{id}.webp
}

export interface CtaEftItemDetail extends CtaEftItem {
  description: string | null;
  categoryName: string | null;
  properties: ItemProperties; // типизированный union из схемы БД
}

export interface CtaItemsResponse {
  count: number;
  items: CtaEftItem[];
}

export interface GetItemsOptions {
  search?: string;
  category?: string;
  type?: ItemProperties["type"];
  limit?: number;
  offset?: number;
}

/* ───────────────── базовый URL для self-fetch ───────────────── */
function baseUrl(): string {
  if (typeof window !== "undefined") return ""; // браузер — относительный путь
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/* ───────────────── публичные методы ───────────────── */
export async function getCtaEftItems(
  opts: GetItemsOptions = {},
): Promise<CtaItemsResponse> {
  const qs = new URLSearchParams();
  if (opts.search) qs.set("search", opts.search);
  if (opts.category) qs.set("category", opts.category);
  if (opts.type) qs.set("type", opts.type);
  if (opts.limit != null) qs.set("limit", String(opts.limit));
  if (opts.offset != null) qs.set("offset", String(opts.offset));
  const q = qs.toString();

  const res = await fetch(
    `${baseUrl()}/api/eft/items${q ? `?${q}` : ""}`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) throw new Error(`CTA API /eft/items → ${res.status}`);
  return res.json() as Promise<CtaItemsResponse>;
}

export async function getCtaEftItem(
  id: string,
): Promise<CtaEftItemDetail | null> {
  const res = await fetch(`${baseUrl()}/api/eft/items/${id}`, {
    next: { revalidate: 3600 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`CTA API /eft/items/${id} → ${res.status}`);
  return res.json() as Promise<CtaEftItemDetail>;
}
