import Link from 'next/link';

export interface SectionPlaceholderTab {
  id: string;
  label: string;
  href: string;
  iconUrl?: string;
}

interface SectionPlaceholderProps {
  title: string;
  description?: string;
  iconUrl?: string;
  iconClass?: string;
  tabs?: SectionPlaceholderTab[];
  /** Текущий путь — для подсветки активного таба (server-side, без usePathname). */
  activeHref?: string;
  /** Скрыть шапку (иконка+заголовок+табы) — когда её уже рендерит внешний HubNav. */
  hideHeader?: boolean;
}

const MASK_BASE = {
  WebkitMaskSize: 'contain' as const,
  WebkitMaskPosition: 'center' as const,
  WebkitMaskRepeat: 'no-repeat' as const,
  maskSize: 'contain' as const,
  maskPosition: 'center' as const,
  maskRepeat: 'no-repeat' as const,
};

/**
 * «Умная заглушка» раздела: сохраняет навигацию (иконка + заголовок + табы +
 * хлеб-крошки рендерятся глобальным хедером), а не превращается в тупик.
 * Server Component — без client-state.
 */
export function SectionPlaceholder({ title, description, iconUrl, iconClass, tabs, activeHref, hideHeader = false }: SectionPlaceholderProps) {
  return (
    <main className={`flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pb-14 ${hideHeader ? '' : 'pt-7'}`}>
      <div className="w-full max-w-275 px-4 xl:px-0">

        {/* Шапка раздела: иконка + заголовок + табы */}
        {!hideHeader && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8 lg:mb-12">
          <div className="flex items-center gap-4 lg:gap-7">
            <div className="w-21 h-21 shrink-0 bg-(--color-darkbase) rounded-md flex items-center justify-center">
              {iconUrl ? (
                <div
                  aria-hidden="true"
                  className="w-10.5 h-10.5 bg-(--primary)"
                  style={{ WebkitMaskImage: `url(${iconUrl})`, maskImage: `url(${iconUrl})`, ...MASK_BASE }}
                />
              ) : (
                <div aria-hidden="true" className={`w-10.5 h-10.5 bg-(--primary) icon-mask ${iconClass ?? 'icon-eft-lore-tarkov'}`} />
              )}
            </div>
            <div>
              <h1 className="text-[1.75rem] font-blender-medium leading-none tracking-tighter uppercase text-text-primary">
                {title}
              </h1>
              {description && (
                <p className="mt-2 max-w-sm text-sm text-text-secondary font-blender-book">{description}</p>
              )}
            </div>
          </div>

          {tabs && tabs.length > 0 && (
            <div className="flex w-full flex-col gap-4 lg:max-w-125">
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                  Навигация по разделу
                </span>
                <div className="flex-1 h-px bg-lines-hover" />
              </div>
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const isActive = !!activeHref && (activeHref === tab.href || activeHref.startsWith(`${tab.href}/`));
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      title={tab.label}
                      className={`w-9 h-9 rounded flex items-center justify-center transition-[background-color,border-color] duration-200 ${
                        isActive
                          ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]'
                          : 'bg-card-menu border border-lines-hover hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                      }`}
                    >
                      {tab.iconUrl ? (
                        <div
                          aria-hidden="true"
                          className={`w-5.5 h-5.5 transition-[background-color,opacity] duration-200 ${isActive ? 'bg-(--primary) opacity-100' : 'bg-text-primary opacity-60'}`}
                          style={{ WebkitMaskImage: `url(${tab.iconUrl})`, maskImage: `url(${tab.iconUrl})`, ...MASK_BASE }}
                        />
                      ) : (
                        <span className="text-type-caption font-blender-medium uppercase text-text-secondary">{tab.label.slice(0, 2)}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        )}

        {/* Панель «в разработке» — раздел жив и навигируем, не тупик */}
        <div className="relative flex w-full flex-col items-center justify-center rounded-md border border-lines-hover bg-card-menu py-20 px-4 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-md border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]">
            {iconUrl ? (
              <div
                aria-hidden="true"
                className="h-8 w-8 bg-(--primary) opacity-80"
                style={{ WebkitMaskImage: `url(${iconUrl})`, maskImage: `url(${iconUrl})`, ...MASK_BASE }}
              />
            ) : (
              <div aria-hidden="true" className="h-8 w-8 bg-(--primary) opacity-80 animate-pulse rounded-xs" />
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-blender-medium uppercase tracking-widest text-(--primary) drop-shadow-[0_0_15px_rgba(230,142,37,0.35)]">
            Раздел в разработке
          </h2>
          <div className="mt-4 h-px w-50 bg-linear-to-r from-transparent via-(--primary) to-transparent opacity-50" />
          <p className="mt-6 max-w-md text-sm text-text-secondary font-blender-book">
            Модуль «{title}» находится на стадии проектирования. Ожидайте обновления пакетов телеметрии.
          </p>
        </div>

      </div>
    </main>
  );
}
