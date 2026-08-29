import type { Metadata } from 'next';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { barters, crafts } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { getEftPriceMapFromDb } from '@/db/prices';
import { getEftCatalog, type EftCatalogItem } from '@/lib/eft-catalog';
import { getAcquisitionGraph } from '@/db/acquisition-funnel';
import { bestAcquisitionCost, type FunnelNode } from '@/lib/acquisition-funnel';
import { itemIconUrl } from '@/lib/item-icon';
import type { BarterOffer, CraftRecipe } from '@/app/eft/items/item/[slug]/ItemModules';
import { BitcoinProfitClient, type BtcPrices } from './BitcoinProfitClient';

export const metadata: Metadata = { title: 'Прибыль Bitcoin | Убежище ЦТА' };

// id зеркала (tarkov.dev) обоих баков — фиксированные, воронка считается по ним напрямую.
const EXPEDITIONARY_FUEL_ID = '5d1b371186f774253763a656';
const METAL_FUEL_ID = '5d1b36a186f7742523398433';

/**
 * Оптимальный источник получения одного бака — «Выгодный источник». Размеченный
 * union по типу выбранного пути воронки (§глоссарий «Выгодный источник»). barter/craft
 * несут готовую форму BarterOffer/CraftRecipe → рендерятся ТЕМИ ЖЕ карточками
 * страницы предмета (переиспользование, а не форк). trader/flea — компактная строка.
 * none — путь недоступен (пустое зеркало / нет пути): блок показывает заглушку.
 */
export type BestSource =
  | { kind: 'barter'; offer: BarterOffer }
  | { kind: 'craft'; recipe: CraftRecipe }
  | { kind: 'trader'; traderName: string; traderNormalizedName: string; perUnit: number }
  | { kind: 'flea'; perUnit: number }
  | { kind: 'none' };

/** Оптимальная добыча одного бака по воронке: цена за штуку + дерево пути. */
export interface BtcFuelInfo {
  /** цена за 1 канистру по дешевейшему пути воронки (₽); 0 если недоступно/пустое зеркало. */
  perUnit: number;
  /** дерево выбранного пути (источник/LL/инпуты) для блока «что нужно купить»; null если недоступно. */
  path: FunnelNode | null;
}

/**
 * Сериализуемый узел РЕКУРСИВНОГО дерева «откуда взялась сумма» получения предмета —
 * для раскрывашки «Подробнее». Обогащён именами/иконками/фоном из зеркала (§4.11), чтобы
 * клиент рисовал плитки без доступа к БД. Только строки/числа/массивы/undefined —
 * пересекает границу RSC→client. Форма повторяет FunnelNode, но плоско-сериализуема
 * (никаких Map/функций), с обогащением слота и рекурсивными steps.
 */
export interface FunnelBreakdown {
  itemId: string;
  /** display-имя предмета (из каталога). */
  name: string;
  /** короткое имя предмета (из каталога). */
  shortName: string;
  /** наш ассет-URL иконки (не CDN). */
  iconUrl: string;
  /** цвет фона плитки по редкости (из priceMap); undefined если неизвестен. */
  backgroundColor?: string;
  /** normalizedName предмета — ссылка на карточку; undefined если неизвестен. */
  normalizedName?: string;
  /** источник выбранного пути этого узла. */
  source: FunnelNode['source'];
  /** имя торговца/станции ('Барахолка' для flea). */
  sourceName?: string;
  /** normalizedName торговца (аватар/тинт) для source==='trader'. */
  sourceNn?: string;
  /** уровень лояльности/станции для barter/craft. */
  level?: number;
  /** цена за 1 шт выбранного пути (₽). */
  perUnit: number;
  /** сколько штук даёт рецепт на выходе (barter/craft). */
  outCount?: number;
  /** инпуты выбранного рецепта с их под-путями (целый count из движка). */
  steps: { count: number; node: FunnelBreakdown }[];
  /** ветка обрезана по глубине (глубже — ещё дешевле, но дерево не разрастаем). */
  truncated?: boolean;
}

/** Максимальная глубина рекурсивного дерева «Подробнее» (глубже — обрезаем, §V4DYA). */
const FUNNEL_MAX_DEPTH = 4;

/**
 * Форма данных, которую page.tsx отдаёт клиенту. Расширяет BtcPrices (T04) БЕЗ ломки:
 * старое плоское `fuel: { expeditionary; metal }` сохранено (клиент читает его сейчас);
 * добавлены funnel-цены `fuelFunnel` по каждому баку и признак дешевейшего бака `cheapestTank`.
 * T04 переключит клиент на `fuelFunnel`/`cheapestTank`; до тех пор `fuel` держит совместимость.
 */
export interface BtcPricesExtended extends BtcPrices {
  /** оптимальная цена по воронке + путь для каждого бака. */
  fuelFunnel: { expeditionary: BtcFuelInfo; metal: BtcFuelInfo };
  /** какой бак дешевле по perUnit воронки — дефолт-выбор клиента; null если оба недоступны. */
  cheapestTank: 'expeditionary' | 'metal' | null;
  /** «Выгодный источник» — оптимальный путь получить бак, готовый к рендеру карточками (T05). */
  bestSource: { expeditionary: BestSource; metal: BestSource };
  /**
   * ПОЛНОЕ рекурсивное дерево «откуда взялась сумма» получения бака (БЕЗ flat) — для
   * раскрывашки «Подробнее». null если путь недоступен ИЛИ это прямой лист (детализировать
   * нечего). Каждый инпут — свой дешевейший под-путь, вложенно до листьев (глубина ≤4).
   */
  bestSourceDeep: { expeditionary: FunnelBreakdown | null; metal: FunnelBreakdown | null };
}

/** Строка зеркала barters/crafts, нужная для точных normalizedName/level/duration по recipeId. */
interface RecipeMeta {
  traderNormalizedName?: string | null;
  stationNormalizedName?: string | null;
  level: number | null;
  duration?: number | null;
}

// Статический маршрут — перекрывает hideout/[metric]. Цены ТОЛЬКО из зеркала.
async function fetchBtcPrices(): Promise<BtcPricesExtended> {
  try {
    const [priceMap, catalog, graph] = await Promise.all([
      getEftPriceMapFromDb(),
      getEftCatalog(),
      getAcquisitionGraph(),
    ]);
    const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
    const isFlea = (v: { name: string; normalizedName?: string }) =>
      v.name === 'Flea Market' || v.normalizedName === 'flea-market';

    let btcId: string | undefined;
    let gpuId: string | undefined;
    let expedId: string | undefined;
    let metalId: string | undefined;
    for (const [id, p] of priceMap) {
      if (p.normalizedName === 'physical-bitcoin') btcId = id;
      else if (p.normalizedName === 'graphics-card') gpuId = id;
      else if (p.normalizedName === 'expeditionary-fuel-tank') expedId = id;
      else if (p.normalizedName === 'metal-fuel-tank') metalId = id;
    }

    const btc = btcId ? priceMap.get(btcId) : undefined;
    const gpu = gpuId ? priceMap.get(gpuId) : undefined;

    // Дешевейшая cash-закупка предмета из buyFor (как gpuCost); 0 если купить негде.
    const cheapestBuy = (id: string | undefined) => {
      const buys = ((id ? priceMap.get(id) : undefined)?.buyFor ?? []).map(rubVal).filter((v) => v > 0);
      return buys.length ? Math.min(...buys) : 0;
    };

    // Оптимальная добыча бака ПРЯМЫМ путём (flat: 1 уровень, инпуты по рынку, целые
    // количества) — так perUnit карточки и сумма «отдаю» в «Выгодном источнике» сходятся,
    // а числа исполнимы. Полная рекурсия дала бы дробный идеализированный минимум (§V4DYA).
    // Недоступно (Infinity/нет) → { perUnit:0, path:null }.
    const fuelFunnelFor = (itemId: string): BtcFuelInfo => {
      const result = bestAcquisitionCost(itemId, graph, { flat: true });
      if (!Number.isFinite(result.perUnit)) return { perUnit: 0, path: null };
      return { perUnit: result.perUnit, path: result.path };
    };

    const btcTraderVals = (btc?.sellFor ?? []).filter((x) => !isFlea(x.vendor)).map(rubVal).filter((v) => v > 0);
    const btcTherapist = btcTraderVals.length ? Math.max(...btcTraderVals) : 0;
    const btcFleaEntry = (btc?.sellFor ?? []).find((x) => isFlea(x.vendor));
    const btcFlea = btcFleaEntry ? rubVal(btcFleaEntry) : 0;
    const gpuBuys = (gpu?.buyFor ?? []).map(rubVal).filter((v) => v > 0);
    const gpuCost = gpuBuys.length ? Math.min(...gpuBuys) : 0;
    const btcBase = (btcId ? catalog.find((i) => i.id === btcId)?.basePrice : 0) ?? 0;

    const expeditionaryFunnel = fuelFunnelFor(EXPEDITIONARY_FUEL_ID);
    const metalFunnel = fuelFunnelFor(METAL_FUEL_ID);

    // Дешевейший бак по воронке — только среди доступных (perUnit > 0). Оба недоступны → null.
    const cheapestTank: BtcPricesExtended['cheapestTank'] = pickCheapestTank(
      expeditionaryFunnel.perUnit,
      metalFunnel.perUnit,
    );

    // ── «Выгодный источник» (T05): собрать BestSource из выбранного пути воронки ──
    // Обогащение слота — тем же приёмом, что на странице предмета: имя/short/basePrice
    // из каталога, backgroundColor/normalizedName/marketPrice из priceMap. Иконка —
    // itemIconUrl(id) (наш ассет, не CDN).
    const catalogById = new Map<string, EftCatalogItem>(catalog.map((i) => [i.id, i]));
    const slotItem = (id: string) => {
      const c = catalogById.get(id);
      const p = priceMap.get(id);
      return {
        id,
        name: c?.name ?? id,
        shortName: c?.shortName ?? '',
        image512pxLink: itemIconUrl(id),
        basePrice: c?.basePrice ?? 0,
        backgroundColor: p?.backgroundColor,
        normalizedName: p?.normalizedName || undefined,
        marketPrice: p?.lastLowPrice ?? p?.avg24hPrice,
      };
    };

    // ── ПОЛНОЕ рекурсивное дерево «Подробнее» (FunnelBreakdown) ─────────────────
    // Рекурсивно обогащаем FunnelNode → сериализуемый FunnelBreakdown (имена/иконки/фон
    // из priceMap+catalog, тем же slotItem-приёмом). Глубже FUNNEL_MAX_DEPTH — обрезаем
    // (truncated:true), чтобы дерево не разрасталось (водосборник→вода). Чистая функция.
    const enrichFunnel = (node: FunnelNode, depth: number): FunnelBreakdown => {
      const c = catalogById.get(node.itemId);
      const p = priceMap.get(node.itemId);
      const childSteps = node.steps ?? [];
      // На пороге глубины ветку не разворачиваем — помечаем truncated (если было куда идти).
      const atCap = depth >= FUNNEL_MAX_DEPTH;
      const steps =
        atCap || childSteps.length === 0
          ? []
          : childSteps.map((s) => ({ count: s.count, node: enrichFunnel(s.node, depth + 1) }));
      return {
        itemId: node.itemId,
        name: c?.name ?? node.itemId,
        shortName: c?.shortName ?? '',
        iconUrl: itemIconUrl(node.itemId),
        ...(p?.backgroundColor ? { backgroundColor: p.backgroundColor } : {}),
        ...(p?.normalizedName ? { normalizedName: p.normalizedName } : {}),
        source: node.source,
        ...(node.sourceName ? { sourceName: node.sourceName } : {}),
        ...(node.sourceNn ? { sourceNn: node.sourceNn } : {}),
        ...(node.level != null ? { level: node.level } : {}),
        perUnit: node.perUnit,
        ...(node.outCount != null ? { outCount: node.outCount } : {}),
        steps,
        ...(atCap && childSteps.length > 0 ? { truncated: true } : {}),
      };
    };

    // Дерево «Подробнее» = обогащённый ТОТ ЖЕ flat-путь, что питает headline-карточку
    // (fuelFunnel[tank].path / bestSource), а НЕ отдельная глубокая рекурсия. Так Σ дерева
    // сходится с числом карточки (напр. металл ≈197 392) — без подвоха «под кнопкой другое
    // число» (решение V4DYA). flat-путь мелкий (рецепт → прямые покупки инпутов); cap 4 всё
    // равно оставляем страховкой. Лист-покупка (нет steps) / недоступно → null: кнопки нет.
    const deepFrom = (path: FunnelNode | null): FunnelBreakdown | null => {
      if (!path || !Number.isFinite(path.perUnit) || !path.steps?.length) return null;
      return enrichFunnel(path, 0);
    };
    const bestSourceDeep: BtcPricesExtended['bestSourceDeep'] = {
      expeditionary: deepFrom(expeditionaryFunnel.path),
      metal: deepFrom(metalFunnel.path),
    };

    // Точные normalizedName/level/duration тянем из зеркала по recipeId выбранных путей
    // (в FunnelNode их нет — sourceName это русское имя). Один запрос по id (только зеркало).
    const recipeMetas = await fetchRecipeMetas(
      [expeditionaryFunnel.path, metalFunnel.path],
    );

    const buildBestSource = (path: FunnelNode | null, canisterId: string): BestSource => {
      if (!path) return { kind: 'none' };
      switch (path.source) {
        case 'trader':
          return {
            kind: 'trader',
            traderName: path.sourceName ?? 'Торговец',
            traderNormalizedName: path.sourceNn ?? '',
            perUnit: path.perUnit,
          };
        case 'flea':
          return { kind: 'flea', perUnit: path.perUnit };
        case 'barter': {
          const steps = path.steps ?? [];
          const meta = path.recipeId ? recipeMetas.barters.get(path.recipeId) : undefined;
          const offer: BarterOffer = {
            id: path.recipeId ?? canisterId,
            trader: {
              name: path.sourceName ?? 'Торговец',
              normalizedName: meta?.traderNormalizedName ?? '',
            },
            level: meta?.level ?? path.level ?? 1,
            requiredItems: steps.map((s) => ({ item: slotItem(s.itemId), count: s.count })),
            reward: { item: slotItem(canisterId), count: path.outCount ?? 1 },
          };
          return { kind: 'barter', offer };
        }
        case 'craft': {
          const steps = path.steps ?? [];
          const meta = path.recipeId ? recipeMetas.crafts.get(path.recipeId) : undefined;
          const recipe: CraftRecipe = {
            id: path.recipeId ?? canisterId,
            station: {
              name: path.sourceName ?? 'Станция',
              normalizedName: meta?.stationNormalizedName ?? '',
            },
            level: meta?.level ?? path.level ?? 1,
            duration: meta?.duration ?? 0,
            requiredItems: steps.map((s) => ({ item: slotItem(s.itemId), count: s.count })),
            reward: { item: slotItem(canisterId), count: path.outCount ?? 1 },
          };
          return { kind: 'craft', recipe };
        }
        default:
          return { kind: 'none' };
      }
    };

    const bestSource: BtcPricesExtended['bestSource'] = {
      expeditionary: buildBestSource(expeditionaryFunnel.path, EXPEDITIONARY_FUEL_ID),
      metal: buildBestSource(metalFunnel.path, METAL_FUEL_ID),
    };

    return {
      btcTherapist,
      btcFlea,
      btcBase,
      gpuCost,
      fuel: { expeditionary: cheapestBuy(expedId), metal: cheapestBuy(metalId) },
      fuelFunnel: { expeditionary: expeditionaryFunnel, metal: metalFunnel },
      cheapestTank,
      bestSource,
      bestSourceDeep,
    };
  } catch (e) {
    console.error('[bitcoin-profit] зеркало недоступно:', e);
    return {
      btcTherapist: 0,
      btcFlea: 0,
      btcBase: 0,
      gpuCost: 0,
      fuel: { expeditionary: 0, metal: 0 },
      fuelFunnel: {
        expeditionary: { perUnit: 0, path: null },
        metal: { perUnit: 0, path: null },
      },
      cheapestTank: null,
      bestSource: { expeditionary: { kind: 'none' }, metal: { kind: 'none' } },
      bestSourceDeep: { expeditionary: null, metal: null },
    };
  }
}

/**
 * Собирает мету рецептов (barters/crafts) по recipeId выбранных путей воронки —
 * точные normalizedName торговца/станции, level и duration, которых нет в FunnelNode
 * (sourceName это русское имя). Один запрос по id к зеркалу (§4.11), без внешних вызовов.
 * Пустой набор id / ошибка → пустые карты (BestSource деградирует к normalizedName '').
 */
async function fetchRecipeMetas(
  paths: (FunnelNode | null)[],
): Promise<{ barters: Map<string, RecipeMeta>; crafts: Map<string, RecipeMeta> }> {
  const barterIds: string[] = [];
  const craftIds: string[] = [];
  for (const p of paths) {
    if (!p?.recipeId) continue;
    if (p.source === 'barter') barterIds.push(p.recipeId);
    else if (p.source === 'craft') craftIds.push(p.recipeId);
  }
  const empty = { barters: new Map<string, RecipeMeta>(), crafts: new Map<string, RecipeMeta>() };
  if (barterIds.length === 0 && craftIds.length === 0) return empty;

  try {
    const gameId = await eftGameId();
    const [barterRows, craftRows] = await Promise.all([
      barterIds.length
        ? db
            .select({
              id: barters.id,
              traderNormalizedName: barters.traderNormalizedName,
              level: barters.level,
            })
            .from(barters)
            .where(and(eq(barters.gameId, gameId), inArray(barters.id, [...new Set(barterIds)])))
        : Promise.resolve([]),
      craftIds.length
        ? db
            .select({
              id: crafts.id,
              stationNormalizedName: crafts.stationNormalizedName,
              level: crafts.level,
              duration: crafts.duration,
            })
            .from(crafts)
            .where(and(eq(crafts.gameId, gameId), inArray(crafts.id, [...new Set(craftIds)])))
        : Promise.resolve([]),
    ]);
    return {
      barters: new Map(
        barterRows.map((r) => [r.id, { traderNormalizedName: r.traderNormalizedName, level: r.level }]),
      ),
      crafts: new Map(
        craftRows.map((r) => [
          r.id,
          { stationNormalizedName: r.stationNormalizedName, level: r.level, duration: r.duration },
        ]),
      ),
    };
  } catch (e) {
    console.error('[bitcoin-profit] мета рецептов недоступна:', e);
    return empty;
  }
}

/** Дешевейший бак по perUnit воронки среди доступных (>0); оба недоступны → null. */
function pickCheapestTank(exped: number, metal: number): 'expeditionary' | 'metal' | null {
  const expedOk = exped > 0;
  const metalOk = metal > 0;
  if (expedOk && metalOk) return exped <= metal ? 'expeditionary' : 'metal';
  if (expedOk) return 'expeditionary';
  if (metalOk) return 'metal';
  return null;
}

// Рендер в рантайме: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function BitcoinProfitPage() {
  const prices = await fetchBtcPrices();

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <BitcoinProfitClient prices={prices} />
      </div>
    </main>
  );
}
