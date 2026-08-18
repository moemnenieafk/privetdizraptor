// Типизированный клиент внутреннего CTA API (слой 3).
// Заменяет прямые обращения к api.tarkov.dev: данные идут из нашей Supabase.
//
// Работает и на сервере (RSC), и в браузере: на сервере self-fetch требует
// абсолютный URL, в браузере — относительный.
import type { ItemProperties } from "@/db/schema";
import type { PlayerProfile } from "@/store/usePlayerStore";
import type { SocialPlatform } from "@/lib/auth/me";

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
  image: string; // URL иконки (Supabase Storage, см. itemIconUrl)
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

/* ───────────────── прогресс квестов (слой 4b) ───────────────── */
// Форма 1:1 повторяет persisted-поля useQuestStore.
export interface ProgressPayload {
  completedQuests: string[];
  itemProgress: Record<string, Record<string, number>>;
  pinnedQuests: string[];
  questNotes: Record<string, string>;
}

// Прогресс текущего пользователя из сессии. null — не авторизован.
export async function getCtaProgress(): Promise<ProgressPayload | null> {
  const res = await fetch(`${baseUrl()}/api/eft/progress`, { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`CTA API /eft/progress → ${res.status}`);
  return res.json() as Promise<ProgressPayload>;
}

// Сохранить прогресс. false — не авторизован/ошибка.
// keepalive=true — запрос переживает выгрузку страницы (flush отметки при уходе, чтобы ни одна
// отметка не потерялась из-за debounce). Лимит keepalive-тела — 64КБ; наш payload меньше.
export async function saveCtaProgress(p: ProgressPayload, keepalive = false): Promise<boolean> {
  const res = await fetch(`${baseUrl()}/api/eft/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
    keepalive,
  });
  return res.ok;
}

/* ───────────────── чекпоинты прогресса (фикс-слоты) ───────────────── */
// В отличие от saveCtaProgress (одна живая строка) — снимки в слотах: 0 = автосохранение
// (страховка перед restore/сбросом), 1..3 = ручные. Привязаны к аккаунту → грузятся с любого
// устройства. Сохранение = upsert по слоту (перезапись).
export const AUTO_SLOT = 0;

export interface SlotMeta {
  slot: number; // 0 = авто, 1..3 = ручной
  name: string;
  createdAt: string;
  completedCount: number;
}

// Все занятые слоты текущего юзера (без тяжёлого payload). null — не авторизован.
export async function listSlots(): Promise<SlotMeta[] | null> {
  const res = await fetch(`${baseUrl()}/api/eft/checkpoints`, { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`CTA API /eft/checkpoints → ${res.status}`);
  const json = (await res.json()) as { slots: SlotMeta[] };
  return json.slots;
}

// Сохранить снимок прогресса в слот (перезапись). false — не авторизован/ошибка.
export async function saveSlot(
  slot: number,
  name: string,
  payload: ProgressPayload,
): Promise<boolean> {
  const res = await fetch(`${baseUrl()}/api/eft/checkpoints`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot, name, payload }),
  });
  return res.ok;
}

// Полный payload слота для восстановления. null — пусто/не авторизован.
export async function getSlot(slot: number): Promise<ProgressPayload | null> {
  const res = await fetch(`${baseUrl()}/api/eft/checkpoints/${slot}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<ProgressPayload>;
}

// Очистить слот. false — ошибка.
export async function clearSlot(slot: number): Promise<boolean> {
  const res = await fetch(`${baseUrl()}/api/eft/checkpoints/${slot}`, { method: "DELETE" });
  return res.ok;
}

/* ───────────────── трекинг достижений (Фаза 2) ───────────────── */
// Форма 1:1 повторяет persisted-поля useAchievementStore.
export interface AchievementProgressPayload {
  completedIds: string[];
  trackedIds: string[];
}

// Трекинг достижений текущего пользователя из сессии. null — не авторизован.
export async function getCtaAchievementProgress(): Promise<AchievementProgressPayload | null> {
  const res = await fetch(`${baseUrl()}/api/eft/achievement-progress`, { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`CTA API /eft/achievement-progress → ${res.status}`);
  return res.json() as Promise<AchievementProgressPayload>;
}

// Сохранить трекинг достижений. false — не авторизован/ошибка.
export async function saveCtaAchievementProgress(p: AchievementProgressPayload): Promise<boolean> {
  const res = await fetch(`${baseUrl()}/api/eft/achievement-progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  return res.ok;
}

/* ───────────────── прогресс бартера / геймификация (слой 4c) ───────────────── */
// Форма 1:1 повторяет persisted-поля useGamificationStore.
export interface BarterProgressPayload {
  xp: number;
  confirmedBarterIds: string[];
  badges: { id: string; label: string; description: string; unlockedAt: number | null }[];
  streak: number;
  bestStreak: number;
  dailyDate: string | null;
  dailyProfit: number;
  lifetimeProfit: number;
  lifetimeSavings: number;
}

// Прогресс бартера текущего пользователя из сессии. null — не авторизован.
export async function getCtaBarterProgress(): Promise<BarterProgressPayload | null> {
  const res = await fetch(`${baseUrl()}/api/eft/barter-progress`, { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`CTA API /eft/barter-progress → ${res.status}`);
  return res.json() as Promise<BarterProgressPayload>;
}

// Сохранить прогресс бартера. false — не авторизован/ошибка.
export async function saveCtaBarterProgress(p: BarterProgressPayload): Promise<boolean> {
  const res = await fetch(`${baseUrl()}/api/eft/barter-progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  return res.ok;
}

/* ───────────────── прогресс battlepass-трекера (слой 4e) ───────────────── */
// Форма 1:1 повторяет persisted-поля useBattlePassStore (ключ верхнего уровня = slug сезона).
export interface BattlePassProgressPayload {
  claimed: Record<string, string[]>;
  docCounts: Record<string, Record<string, number>>;
}

// Прогресс battlepass-трекера текущего пользователя из сессии. null — не авторизован.
export async function getCtaBattlePassProgress(): Promise<BattlePassProgressPayload | null> {
  const res = await fetch(`${baseUrl()}/api/eft/battlepass-progress`, { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`CTA API /eft/battlepass-progress → ${res.status}`);
  return res.json() as Promise<BattlePassProgressPayload>;
}

// Сохранить прогресс battlepass-трекера. false — не авторизован/ошибка.
export async function saveCtaBattlePassProgress(p: BattlePassProgressPayload): Promise<boolean> {
  const res = await fetch(`${baseUrl()}/api/eft/battlepass-progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  return res.ok;
}

/* ───────────────── игровые профили (слой 4d) ───────────────── */
// Форма 1:1 повторяет persisted-поля usePlayerStore.
export interface PlayerProfilePayload {
  profiles: PlayerProfile[];
  activeProfileId: string;
}

// Игровые профили текущего пользователя из сессии. null — не авторизован.
export async function getCtaPlayerProfile(): Promise<PlayerProfilePayload | null> {
  const res = await fetch(`${baseUrl()}/api/eft/player-profile`, { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`CTA API /eft/player-profile → ${res.status}`);
  return res.json() as Promise<PlayerProfilePayload>;
}

// Сохранить игровые профили. false — не авторизован/ошибка.
export async function saveCtaPlayerProfile(p: PlayerProfilePayload): Promise<boolean> {
  const res = await fetch(`${baseUrl()}/api/eft/player-profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  return res.ok;
}

/* ───────────────── аккаунт-идентичность (слой 4 / Фаза 2) ───────────────── */
// Мутации кабинета: логин/e-mail/пароль/аватар. Вызываются из клиента.
// Возвращают { ok, error? } — текст ошибки приходит с сервера (кулдаун/занято/…).
export interface AccountResult {
  ok: boolean;
  error?: string;
}

async function readError(res: Response): Promise<string> {
  const json = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof json?.error === "string" ? json.error : "Произошла ошибка";
}

// Сменить логин (3–15 символов, уникальный, раз в 2 месяца).
export async function changeUsername(username: string): Promise<AccountResult> {
  const res = await fetch(`${baseUrl()}/api/account/username`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

// Привязать/отвязать соц-аккаунт (ручной хендл; пустой = отвязать).
export async function saveSocials(
  socials: Partial<Record<SocialPlatform, string>>,
): Promise<AccountResult> {
  const res = await fetch(`${baseUrl()}/api/account/social`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ socials }),
  });
  return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

// Сохранить настройки рассылок (3 булевых флага). Шлём только изменённые.
export async function saveNotifications(
  notifications: Partial<Record<"account" | "offers" | "news", boolean>>,
): Promise<AccountResult> {
  const res = await fetch(`${baseUrl()}/api/account/notifications`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notifications }),
  });
  return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

// Сменить e-mail (Supabase шлёт подтверждение на новый адрес).
export async function changeEmail(email: string): Promise<AccountResult> {
  const res = await fetch(`${baseUrl()}/api/account/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}

// Запросить ссылку сброса пароля на e-mail из сессии. email — куда ушло письмо.
export async function requestPasswordReset(): Promise<AccountResult & { email?: string }> {
  const res = await fetch(`${baseUrl()}/api/account/password`, { method: "POST" });
  if (!res.ok) return { ok: false, error: await readError(res) };
  const json = (await res.json().catch(() => null)) as { email?: string } | null;
  return { ok: true, email: json?.email };
}

// Загрузить аватар (готовый квадратный webp-blob из canvas). url — новый адрес картинки.
export async function uploadAvatar(file: Blob): Promise<AccountResult & { url?: string }> {
  const fd = new FormData();
  fd.append("file", file, "avatar.webp");
  const res = await fetch(`${baseUrl()}/api/account/avatar`, { method: "POST", body: fd });
  if (!res.ok) return { ok: false, error: await readError(res) };
  const json = (await res.json().catch(() => null)) as { url?: string } | null;
  return { ok: true, url: json?.url };
}

// Сбросить ВЕСЬ прогресс ЧВК (EFT) текущего юзера. Необратимо (чистит quest/barter/profiles).
export async function resetCtaProgress(): Promise<AccountResult> {
  const res = await fetch(`${baseUrl()}/api/account/reset-progress`, { method: "POST" });
  return res.ok ? { ok: true } : { ok: false, error: await readError(res) };
}
