import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HEADER_DICTIONARY, MenuItem } from '@/data/headerConfig';
import { ItemsCategoryClient } from './ItemsCategoryClient';
import { HubNav } from '@/components/features/items/HubNav';
import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';
import { buildQuestIndicators } from '@/lib/eft-indicators.economics';
import { EFT_QUESTS } from '@/data/quests';
import { getEftCategoryItems, getSubcategoryMembership } from '@/lib/eft-category';
import { getEftIndicatorsFromDb } from '@/db/indicators';
import { getHideoutRequirementMap } from '@/db/hideout';
import { getModCompatibilityMap } from '@/db/weapons';
import { getCurrencyRates } from '@/db/prices';
import { MOD_SLUGS } from '@/lib/items-filter-config';

interface Props {
  params: Promise<{ category: string[] }>;
}

// ISR: категории пререндерятся (см. generateStaticParams), цены освежаются раз в час.
// Рантайм-чтение прайс-карты (5.5 МБ) убрано — на билде memoTTL читает её один раз на все
// категории; на проде страница отдаётся статикой. dynamicParams=true (дефолт) → редкие
// непрописанные пути всё равно отрендерятся on-demand.
export const revalidate = 3600;

// Пререндер всех путей категорий из меню EFT (иначе catch-all рендерится динамически).
export function generateStaticParams(): { category: string[] }[] {
  const PREFIX = '/eft/items/';
  const out: { category: string[] }[] = [];
  const walk = (nodes: MenuItem[]) => {
    for (const n of nodes) {
      if (n.path && n.path.startsWith(PREFIX)) out.push({ category: n.path.slice(PREFIX.length).split('/') });
      if (n.children) walk(n.children);
    }
  };
  walk(HEADER_DICTIONARY['eft'].menuItems);
  return out;
}

// Рекурсивный поиск узла в дереве меню
function findNodeByPath(items: MenuItem[], targetPath: string): MenuItem | null {
  for (const item of items) {
    if (item.path === targetPath) return item;
    if (item.children) {
      const found = findNodeByPath(item.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

/** Сужает карту индикаторов до предметов текущей категории — не шлём лишнее в клиент. */
function pickByIds<T>(map: Record<string, T>, ids: Set<string>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const id of ids) {
    const v = map[id];
    if (v !== undefined) out[id] = v;
  }
  return out;
}

export default async function ItemsDynamicPage({ params }: Props) {
  const resolvedParams = await params;
  const currentPath = `/eft/items/${resolvedParams.category.join('/')}`;
  const slug = resolvedParams.category[resolvedParams.category.length - 1];

  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  const currentNode = findNodeByPath(eftMenu, currentPath);
  if (!currentNode) notFound();

  const hasChildren = currentNode.children && currentNode.children.length > 0;
  const parentPath = currentPath.split('/').slice(0, -1).join('/');
  const parentNode = findNodeByPath(eftMenu, parentPath);

  const tabSource = hasChildren
    ? currentNode.children!
    : (parentNode && parentNode.path !== '/eft/items' && parentNode.children)
      ? parentNode.children
      : null;

  const tabs = tabSource?.map((child) => ({
    id: child.id,
    label: child.label,
    menuTitle: child.menuTitle,
    href: child.path || '#',
    iconUrl: child.iconUrl || child.iconUrlBear || '',
    preserveIconColor: child.path?.startsWith('/eft/items/mods/') ?? false,
  }));

  // «Выбор категорий»: только для НЕконечных разделов (текущий узел с детьми).
  // Опции = прямые дети-категории каталога (совпадают с под-навигацией HubNav);
  // принадлежность считается серверно тем же selectForSlug, что и дочерние страницы.
  const subcatChildren = (hasChildren ? currentNode.children! : [])
    .filter((c) => c.path?.startsWith('/eft/items/'));
  const subcatOptions = subcatChildren.map((c) => ({
    id: c.path!.split('/').pop()!,
    label: c.menuTitle ?? c.label,
    iconUrl: c.iconUrl || c.iconUrlBear || '',
    // моды: иконки со своей заливкой — рендерим как <img>, а не маску (как в HubNav)
    preserveIconColor: c.path?.startsWith('/eft/items/mods/') ?? false,
  }));

  const pageId = `eft-items-${resolvedParams.category.join('-')}`;
  const pageContent = PAGE_CONTENT_DICTIONARY[pageId];

  // Предметы категории + индикаторы (бартер/крафт/GP) — всё из НАШЕЙ Supabase.
  // В рантайме страница в api.tarkov.dev не ходит (цены/бартеры/крафты зеркалит крон).
  const [itemsData, indicators, rates, subcatMembershipAll, hideoutReqAll] = await Promise.all([
    getEftCategoryItems(slug),
    getEftIndicatorsFromDb(),
    getCurrencyRates(''),
    getSubcategoryMembership(subcatOptions.map((o) => o.id)),
    getHideoutRequirementMap(),
  ]);

  // Квест-индикаторы: определения из статического EFT_QUESTS (на сервере, не в
  // клиент-бандле); живой прогресс накладывается на клиенте из quest-стора.
  const { dataMap: questDataMap, refMap: questRefMap } = buildQuestIndicators(
    EFT_QUESTS,
    indicators.barterUnlockMap,
  );

  // Сужаем карты до предметов текущей категории.
  const itemIds = new Set(itemsData.map((i) => i.id));
  const barterDataMap = pickByIds(indicators.barterDataMap, itemIds);
  const craftDataMapForCategory = pickByIds(indicators.craftDataMap, itemIds);
  const questDataMapForCategory = pickByIds(questDataMap, itemIds);
  const questRefMapForCategory = pickByIds(questRefMap, itemIds);
  const subcatMembership = pickByIds(subcatMembershipAll, itemIds);
  const hideoutReqMap = pickByIds(hideoutReqAll, itemIds);

  // «Совместимо с оружием» — только на слагах модов. Map кэширован; сужаем до категории.
  const compat = MOD_SLUGS.includes(slug) ? await getModCompatibilityMap() : null;
  const modToWeapons = compat ? pickByIds(compat.modToWeapons, itemIds) : {};
  const compatWeapons = compat ? compat.weapons : [];

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <HubNav
          iconClass={pageContent?.iconClass}
          iconUrl={pageContent?.iconClass ? undefined : (currentNode.iconUrl || currentNode.iconUrlBear)}
          title={pageContent?.title ?? currentNode.label}
          description={pageContent?.description}
          count={itemsData.length}
          tabs={tabs}
        />

        <Suspense>
          <ItemsCategoryClient
            initialData={itemsData}
            categorySlug={slug}
            gpCoinBarters={indicators.gpCoinBarters}
            barterDataMap={barterDataMap}
            craftDataMap={craftDataMapForCategory}
            questDataMap={questDataMapForCategory}
            questRefMap={questRefMapForCategory}
            rates={rates}
            subcatOptions={subcatOptions}
            subcatMembership={subcatMembership}
            hideoutReqMap={hideoutReqMap}
            compatWeapons={compatWeapons}
            modToWeapons={modToWeapons}
          />
        </Suspense>
      </div>
    </main>
  );
}
