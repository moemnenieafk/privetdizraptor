'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { getHeaderConfig } from '@/data/headerConfig';


export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = (pathname || '').split('/').filter(Boolean); // Защита от null при SSR роутинге

  // Подтягиваем словарь крошек из конфига текущей игры
  const config = getHeaderConfig(pathname || '');
  const breadcrumbNames = config.breadcrumbNames || {};

  // Не показываем крошки на главной странице раздела /eft
  if (segments.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex w-full items-center">
      {/* flex-wrap позволяет переносить крошки на новую строку, а text-[10px] sm:text-xs делает их аккуратнее на телефонах */}
      <ol className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-blender-medium uppercase tracking-wider">
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const isLast = index === segments.length - 1;
          const name = breadcrumbNames[segment] || segment;

          return (
            <Fragment key={href}>
              <li>
                <Link
                  href={href}
                  aria-current={isLast ? 'page' : undefined}
                  className={`transition-colors ${isLast ? 'text-primary pointer-events-none' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {name}
                </Link>
              </li>
              {!isLast && <li aria-hidden="true" className="text-text-muted">/</li>}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}