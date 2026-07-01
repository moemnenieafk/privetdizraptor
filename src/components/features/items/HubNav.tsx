"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useItemsStore } from "@/store/useItemsStore";

export interface HubNavTab {
  id: string;
  label: string;
  menuTitle?: string;
  href: string;
  iconUrl?: string;
  preserveIconColor?: boolean;
}

const DEFAULT_CATEGORIES: HubNavTab[] = [
  { id: 'i-barter',           label: 'Предметы для Бартера', menuTitle: 'Для Бартера',   href: '/eft/items/barter',          iconUrl: '/icons/eft/04-progression/barter-profit.svg' },
  { id: 'i-gear',             label: 'Снаряжение',                                        href: '/eft/items/gear',             iconUrl: '/icons/eft/03-items/gear.svg' },
  { id: 'i-mods',             label: 'Моды',                                              href: '/eft/items/mods',             iconUrl: '/icons/eft/03-items/guns/cat-gunmods.svg' },
  { id: 'i-weapons',          label: 'Оружие',                                            href: '/eft/items/weapons',          iconUrl: '/icons/eft/03-items/guns.svg' },
  { id: 'i-ammo',             label: 'Боеприпасы',                                        href: '/eft/items/ammo',             iconUrl: '/icons/eft/03-items/guns/cat-ammo.svg' },
  { id: 'i-provisions',       label: 'Провизия',                                          href: '/eft/items/provisions',       iconUrl: '/icons/eft/03-items/equipment/provisions.svg' },
  { id: 'i-meds',             label: 'Медикаменты',                                       href: '/eft/items/meds',             iconUrl: '/icons/eft/03-items/equipment/meds.svg' },
  { id: 'i-keys',             label: 'Ключи',                                             href: '/eft/items/keys',             iconUrl: '/icons/eft/03-items/equipment/keys.svg' },
  { id: 'i-questitems',       label: 'Предметы для Заданий', menuTitle: 'Для Заданий',   href: '/eft/items/quest-items',      iconUrl: '/icons/eft/03-items/questitems.svg' },
  { id: 'i-info',             label: 'Инфо предметы',                                     href: '/eft/items/info',             iconUrl: '/icons/eft/03-items/equipment/infoitems.svg' },
  { id: 'i-specialequipment', label: 'Спецоборудование',                                  href: '/eft/items/specialequipment', iconUrl: '/icons/eft/03-items/equipment/special-equipment.svg' },
];

const TRADERS = [
  { id: 'prapor',      label: 'Прапор',      image: '/images/traders/eft/prapor.webp' },
  { id: 'therapist',   label: 'Терапевт',    image: '/images/traders/eft/therapist.webp' },
  { id: 'fence',       label: 'Скупщик',       image: '/images/traders/eft/fence.webp' },
  { id: 'skier',       label: 'Лыжник',      image: '/images/traders/eft/skier.webp' },
  { id: 'peacekeeper', label: 'Миротворец',  image: '/images/traders/eft/peacekeeper.webp' },
  { id: 'mechanic',    label: 'Механик',     image: '/images/traders/eft/mechanic.webp' },
  { id: 'ragman',      label: 'Барахольщик', image: '/images/traders/eft/ragman.webp' },
  { id: 'jaeger',      label: 'Егерь',       image: '/images/traders/eft/jaeger.webp' },
  { id: 'ref',         label: 'Реф',         image: '/images/traders/eft/ref.webp' },
];

const MASK_BASE = {
  WebkitMaskSize: 'contain' as const,
  WebkitMaskPosition: 'center' as const,
  WebkitMaskRepeat: 'no-repeat' as const,
  maskSize: 'contain' as const,
  maskPosition: 'center' as const,
  maskRepeat: 'no-repeat' as const,
};

interface HubNavProps {
  tabs?: HubNavTab[];
  iconClass?: string;
  iconUrl?: string;
  title: string;
  description?: string;
  count?: number;
  activeHref?: string;
}

export function HubNav({ tabs, iconClass, iconUrl, title, description, count, activeHref }: HubNavProps) {
  const pathname = usePathname();
  const selectedTraders = useItemsStore((state) => state.selectedTraders);
  const toggleTrader = useItemsStore((state) => state.toggleTrader);
  const categories = tabs ?? DEFAULT_CATEGORIES;

  return (
    <div className="w-full max-w-275 mx-auto flex flex-col lg:flex-row justify-between lg:items-end gap-6 lg:gap-12 mb-8 lg:mb-12">

      {/* Left Block: Icon + Title + Description */}
      <div className="flex items-end gap-4 lg:gap-7">
        <div className="w-21 h-21 shrink-0 bg-(--color-darkbase) rounded-md flex items-center justify-center">
          <div className="text-(--primary) [&>svg]:fill-current [&>path]:fill-current">
            {iconUrl ? (
              <div
                aria-hidden="true"
                className="w-10.5 h-10.5 bg-(--primary)"
                style={{ WebkitMaskImage: `url(${iconUrl})`, maskImage: `url(${iconUrl})`, ...MASK_BASE }}
              />
            ) : (
              <div
                aria-hidden="true"
                className={`w-10.5 h-10.5 bg-(--primary) icon-mask ${iconClass ?? 'icon-eft-items-loot-tier'}`}
              />
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-blender-medium leading-none tracking-tighter uppercase text-text-primary">
              {title}
            </h1>
            {count != null && count > 0 && (
              <span className="px-2 py-0.5 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] border border-(--primary)/40 rounded font-blender-medium text-sm text-(--primary) leading-snug">
                {count}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-2 text-sm text-text-secondary max-w-sm">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Right Block: Label + Categories + Traders */}
      <div className="flex flex-col w-full lg:max-w-125 gap-4">

        {/* Section Label + Divider */}
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Навигация по разделу
          </span>
          <div className="flex-1 h-px bg-lines-hover" />
        </div>

        {/* Categories + Traders: на мобиле стекируются, на lg — side by side */}
        <div className="flex flex-col gap-3 lg:flex-row lg:gap-6">

          {/* Category Buttons */}
          <div className="flex flex-wrap gap-2 w-full lg:w-64">
            {categories.map((cat) => {
              const isActive =
                pathname === cat.href ||
                pathname.startsWith(`${cat.href}/`) ||
                (!!activeHref && (activeHref === cat.href || activeHref.startsWith(`${cat.href}/`)));
              return (
                <Link
                  key={cat.id}
                  href={cat.href}
                  title={cat.menuTitle ?? cat.label}
                  className={`w-9 h-9 rounded flex items-center justify-center transition-[background-color,border-color] duration-200 ${
                    isActive
                      ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]'
                      : 'bg-card-menu border border-lines-hover hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                  }`}
                >
                  {cat.preserveIconColor ? (
                     
                    <img src={cat.iconUrl ?? ''} alt="" className="w-5.5 h-5.5 object-contain" />
                  ) : (
                    <div
                      aria-hidden="true"
                      className={`w-5.5 h-5.5 transition-[background-color,opacity] duration-200 ${isActive ? 'bg-(--primary) opacity-100' : 'bg-text-primary opacity-60'}`}
                      style={{
                        WebkitMaskImage: `url(${cat.iconUrl ?? ''})`,
                        maskImage: `url(${cat.iconUrl ?? ''})`,
                        ...MASK_BASE,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Trader Toggle Buttons */}
          <div className="flex flex-wrap gap-2 w-full lg:flex-1">
            {TRADERS.map((trader) => {
              const isActive = selectedTraders.length === 0 || selectedTraders.includes(trader.id);
              return (
                <button
                  key={trader.id}
                  type="button"
                  title={trader.label}
                  onClick={() => toggleTrader(trader.id)}
                  className={`w-9 h-9 rounded overflow-hidden cursor-pointer transition-opacity duration-200 ${
                    isActive ? 'opacity-100' : 'opacity-25 hover:opacity-75'
                  }`}
                >
                  <Image
                    src={trader.image}
                    alt={trader.label}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
