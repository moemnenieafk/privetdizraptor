// Гибрид-автономия по иконкам: зеркалит НЕДОСТАЮЩИЕ 512px-иконки EFT из tarkov.dev
// в наш Supabase Storage (cta-media/items/eft/{id}.webp) — как статический ассет, не per-request.
//
// Почему так (см. !future-requests/tarkov-dev-512px-icons-research.md):
//   512px у tarkov.dev = даунскейл отрендеренного 3D-мастера; готового спрайта в бандлах НЕТ,
//   а рантайм-рендер из боевого клиента блокируется BattlEye. Поэтому для НОВЫХ предметов,
//   которых tarkov.dev ещё не отрисовал, иконки временно нет нигде — крон «дозальёт» их,
//   как только tarkov.dev отрендерит настоящую 512px. Это ЕДИНСТВЕННАЯ точка контакта с tarkov.dev
//   (серверный крон), UI читает только наш бакет — правило автономии соблюдено.
//
// Список целей — src/data/icon-backfill-eft.json (предметы, у которых у нас стоит заглушка);
// генерируется `node scripts/find-missing-icons.mjs`. Идемпотентно (upsert); предметы, которые
// у tarkov.dev всё ещё unknown-item, пропускаются и дождутся следующего прогона.
import { createClient } from "@supabase/supabase-js";
import backfillIds from "@/data/icon-backfill-eft.json";
import { fetchWithFallback, fetchTarkovJson, fetchTarkovGraphQL } from "@/lib/tarkov-fallback";

const BUCKET = "cta-media";
const PREFIX = "items/eft";
const MAX_PER_RUN = 200; // верхняя граница работы за прогон (бюджет Vercel 60s)
const CONCURRENCY = 10;

type TdIcon = { id: string; image512pxLink: string | null };

// Настоящая 512px (а не tarkov.dev-плейсхолдер unknown-item).
const isReal = (link: string | null): link is string =>
  !!link && !link.includes("unknown");

// JSON-плоскость (primary): полный /items → выбираем image512pxLink по бэкфилл-id.
interface JsonIconItem { image512pxLink?: string | null }
async function iconsFromJson(ids: string[]): Promise<TdIcon[]> {
  // У /items коллекция вложена: data.items (dict по id).
  const data = await fetchTarkovJson<{ items?: Record<string, JsonIconItem> }>("regular/items");
  const items = data.items ?? {};
  return ids.map((id) => ({ id, image512pxLink: items[id]?.image512pxLink ?? null }));
}

// GraphQL (fallback): точечный запрос по ids (ids вшиваем в запрос — это BSG-id, безопасно).
async function iconsFromGraphQL(ids: string[]): Promise<TdIcon[]> {
  const data = await fetchTarkovGraphQL<{ items?: TdIcon[] }>(
    `query { items(ids: ${JSON.stringify(ids)}) { id image512pxLink } }`,
  );
  return data.items ?? [];
}

export type SyncIconsResult = {
  iconsChecked: number; // сколько id вернул tarkov.dev
  iconsReady: number; // у скольких уже есть настоящая 512px
  iconsFilled: number; // успешно залито в наш бакет
  iconsFailed: number; // ошибки скачивания/заливки
  iconsStillMissing: number; // у tarkov.dev пока тоже заглушка — ждём
};

export async function syncEftIcons(): Promise<SyncIconsResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("нет NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  const ids = (backfillIds as string[]).slice(0, MAX_PER_RUN);
  const items = await fetchWithFallback<TdIcon>(
    () => iconsFromJson(ids),
    () => iconsFromGraphQL(ids),
    "icons",
  );
  const ready = items.filter((it) => isReal(it.image512pxLink));

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const bucket = admin.storage.from(BUCKET);

  let filled = 0;
  let failed = 0;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < ready.length) {
      const it = ready[cursor++];
      try {
        const imgRes = await fetch(it.image512pxLink!);
        if (!imgRes.ok) throw new Error(`img HTTP ${imgRes.status}`);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const { error } = await bucket.upload(`${PREFIX}/${it.id}.webp`, buf, {
          contentType: "image/webp",
          upsert: true,
        });
        if (error) throw error;
        filled++;
      } catch (e) {
        console.error(`[sync-icons] ${it.id}:`, e);
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return {
    iconsChecked: items.length,
    iconsReady: ready.length,
    iconsFilled: filled,
    iconsFailed: failed,
    iconsStillMissing: ids.length - ready.length,
  };
}
