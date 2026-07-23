import Link from 'next/link';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import {
  WeaponModule,
  ArmorModule,
  MedKitModule,
  MedicalItemModule,
  AmmoModule,
  GrenadeModule,
  HeadsetModule,
  HelmetModule,
  BarterModule,
  CraftModule,
  UsedInBarterModule,
  UsedInCraftModule,
} from './ItemModules';
import { ItemImage } from './ItemImage';
import { SlotGrid } from './SlotGrid';
import { ItemActions } from './ItemActions';
import { ItemPriceBlock } from './ItemPriceBlock';
import { ItemQuestBlock } from './ItemQuestBlock';
import { ItemStoryTours } from './ItemStoryTours';
import { ContainerContents } from './ContainerContents';
import { SimilarItems } from './SimilarItems';
import { LootSources } from './LootSources';
import { getItemStoryTours } from '@/lib/item-story-tours';
import type { EftItemData } from '@/components/features/items/EftItemTile';
import { getItemCategory, getItemHeadline } from './item-identity.util';
import type { TarkovItem } from './page';

interface ItemDetailLayoutProps {
  item: TarkovItem;
  similar: EftItemData[];
  buyLevelRequired?: number | null;
  rates?: { usd: number | null; eur: number | null };
  pricesAgeHours?: number | null;
}

// ─── Статус-бейдж: иконка (как в EftItemTile/Indicator) + текст ──────────────
// Чипы БАРТЕР / КРАФТ / ЗАДАНИЕ — точные цвета макета через @theme-токены
// (не raw HEX, не var() в инлайне): kappa #BDA550, mode-pve #0095E2, tactical-amber #E68E25.
type BadgeVariant = 'primary' | 'danger' | 'barter' | 'craft' | 'quest';

interface StatusBadgeData {
  label: string;
  variant: BadgeVariant;
  iconClass?: string;
}

const BADGE_STYLES: Record<BadgeVariant, { box: string; icon: string }> = {
  primary: { box: 'border-(--primary) bg-primary/10 text-(--primary)', icon: 'bg-(--primary)' },
  danger:  { box: 'border-red-500/30 bg-red-500/10 text-red-400', icon: 'bg-red-400' },
  barter:  { box: 'border-kappa/40 bg-kappa/10 text-kappa', icon: 'bg-kappa' },
  craft:   { box: 'border-mode-pve/40 bg-mode-pve/10 text-mode-pve', icon: 'bg-mode-pve' },
  quest:   { box: 'border-tactical-amber/40 bg-tactical-amber/10 text-tactical-amber', icon: 'bg-tactical-amber' },
};

function StatusBadge({ label, variant, iconClass }: StatusBadgeData) {
  const s = BADGE_STYLES[variant];
  return (
    <span className={`inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 font-blender-medium text-[10px] uppercase tracking-widest ${s.box}`}>
      {iconClass && (
        <span className={`${iconClass} h-3 w-3 shrink-0 ${s.icon} mask-contain mask-center mask-no-repeat`} />
      )}
      {label}
    </span>
  );
}

export function ItemDetailLayout({ item, similar, buyLevelRequired, rates, pricesAgeHours }: ItemDetailLayoutProps) {
  const hasBarter = item.barters.length > 0;
  const hasCraft = item.crafts.length > 0;
  const hasQuest = (item.usedInTasks?.length ?? 0) > 0;

  const armorClass =
    item.properties && 'class' in item.properties ? item.properties.class : null;

  // Внутренние секции вместимости (контейнеры/рюкзаки)
  const capacityGrids =
    item.properties && 'grids' in item.properties ? item.properties.grids : undefined;

  // Идентификация: категория + ключевой стат под названием
  const category = getItemCategory(item.types);
  const headline = getItemHeadline(item);

  // Сюжетные истории, где нужен предмет (блок ТУР) — считаем на сервере, тяжёлые
  // данные историй в клиент не уезжают.
  const storyTours = getItemStoryTours(item.id);

  // Статус-бейджи (перенесены из левой колонки) — иконки из EftItemTile/Indicator
  const statusBadges: StatusBadgeData[] = [
    ...(armorClass != null ? [{ label: `Класс ${armorClass}`, variant: 'primary' as const, iconClass: `icon-eft-armor-class-${armorClass}` }] : []),
    ...(item.types.includes('noFlea') ? [{ label: 'Без барахолки', variant: 'danger' as const }] : []),
    ...(hasBarter ? [{ label: 'Бартер', variant: 'barter' as const, iconClass: 'icon-eft-prog-barter' }] : []),
    ...(hasCraft ? [{ label: 'Крафт', variant: 'craft' as const, iconClass: 'icon-eft-prog-craft' }] : []),
    ...(hasQuest ? [{ label: 'Задание', variant: 'quest' as const, iconClass: 'icon-eft-quests-side' }] : []),
  ];

  return (
    <div className="flex flex-col gap-7 lg:flex-row lg:flex-wrap">

      {/* ── ЛЕВАЯ КОЛОНКА ─────────────────────────────── */}
      <aside className="flex w-full flex-col gap-5 lg:w-87 lg:shrink-0">
        <div
          className="relative flex aspect-square items-center justify-center overflow-hidden rounded border border-lines-hover group"
          style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
        >
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,var(--color-text-muted)_1px,transparent_1px)] bg-size-[20px_20px]" />
          <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]" />

          <ItemImage
            id={item.id}
            image512pxLink={item.image512pxLink}
            name={item.name}
            className="z-10 h-full w-full object-contain p-8 drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        <SlotGrid width={item.width} height={item.height} sections={capacityGrids} itemId={item.id} />

        <ItemActions itemId={item.id} />

        {/* Задания переехали в левую колонку по макету 1905:850 */}
        <ItemStoryTours tours={storyTours} itemName={item.name} itemImage={item.image512pxLink} itemBackground={item.backgroundColor} />
        <ItemQuestBlock tasks={item.usedInTasks ?? []} itemId={item.id} itemImage={item.image512pxLink} itemBackground={item.backgroundColor} />
        <LootSources tasks={item.receivedFromTasks ?? []} itemId={item.id} itemName={item.shortName} itemImage={item.image512pxLink} itemBackground={item.backgroundColor} />
      </aside>

      {/* ── ПРАВАЯ КОЛОНКА ────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div>
          <h1 className="mb-2 line-clamp-2 text-3xl leading-tight font-blender-medium text-text-primary lg:text-[42px]">
            {item.name}
          </h1>

          {/* shortName │ категория (кликабельна) · стат │ статус-бейджи — в одну строку */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 font-blender-medium text-sm">
            <span className="uppercase tracking-wider text-text-secondary">{item.shortName}</span>

            {category && (
              <>
                <span className="h-3 w-px bg-lines-hover" />
                <Link
                  href={category.href}
                  className="group/cat flex items-center gap-1.5 text-text-secondary transition-colors hover:text-(--primary)"
                >
                  <span className={`${category.iconClass} h-4 w-4 shrink-0 bg-text-secondary mask-contain mask-center mask-no-repeat transition-colors group-hover/cat:bg-(--primary)`} />
                  <span className="uppercase tracking-wider">{category.label}</span>
                </Link>
              </>
            )}

            {headline && (
              <>
                <span className="text-(--text-muted)">·</span>
                <span className="text-text-secondary">{headline}</span>
              </>
            )}

            {statusBadges.length > 0 && (
              <>
                <span className="mx-1 h-3 w-px bg-lines-hover" />
                {statusBadges.map((b) => (
                  <StatusBadge key={b.label} {...b} />
                ))}
              </>
            )}
          </div>
        </div>

        <ItemPriceBlock
          buyFor={item.buyFor}
          sellFor={item.sellFor}
          slots={item.width * item.height}
          buyLevelRequired={buyLevelRequired}
          rates={rates}
          pricesAgeHours={pricesAgeHours}
          companion={item.companion}
        />

        <WeaponModule properties={item.properties} />
        <ArmorModule properties={item.properties} />
        <HelmetModule properties={item.properties} />
        <AmmoModule properties={item.properties} />
        <GrenadeModule properties={item.properties} />
        <HeadsetModule properties={item.properties} />
        <MedKitModule properties={item.properties} />
        <MedicalItemModule properties={item.properties} />

        {/* Что вмещает контейнер/рюкзак — категории и предметы из фильтров ячеек. */}
        <ContainerContents grids={capacityGrids} />

        {/* Экономика живёт в той же колонке, что и цены: в макете это одна полоса 724. */}
        <BarterModule barters={item.barters} />
        <UsedInBarterModule usedIn={item.usedInBarters ?? []} itemId={item.id} />
        <CraftModule crafts={item.crafts} />
        <UsedInCraftModule usedIn={item.usedInCrafts ?? []} itemId={item.id} />
      </div>

      {/* ── СЕКЦИИ НИЖЕ (full-width) ───────────────────── */}
      <div className="flex w-full flex-col gap-6 lg:w-full lg:basis-full">
        <SimilarItems items={similar} />

        {item.description && (
          <div className="rounded border border-lines-hover bg-card-menu p-5">
            <p className="text-sm leading-relaxed font-blender-book text-text-secondary">
              {item.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
