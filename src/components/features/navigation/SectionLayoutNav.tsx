'use client';

import { usePathname } from 'next/navigation';
import { SectionHubNav } from './SectionHubNav';
import { findSectionNode } from '@/lib/section-hub-nav';

interface SectionLayoutNavProps {
  /** Корень раздела, например '/eft/progress'. */
  rootPath: string;
  /** Подписи левого блока, если активный путь не найден в словаре (служебные страницы). */
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackIconUrl?: string;
  /** Ширина контейнера — под нестандартные раскладки (например, статья max-w-3xl). */
  widthClass?: string;
}

/**
 * Универсальная точка монтирования HubNav в layout раздела.
 *
 * Заголовок, описание и иконку берёт из HEADER_DICTIONARY по активному пути
 * (самое глубокое совпадение), поэтому новый подраздел получает верхнюю
 * навигацию автоматически — достаточно описать его в словаре меню.
 * На индексе раздела не рендерится: там сетка HubCard.
 */
export function SectionLayoutNav({
  rootPath,
  fallbackTitle,
  fallbackDescription,
  fallbackIconUrl,
  widthClass,
}: SectionLayoutNavProps) {
  const pathname = usePathname();
  if (pathname === rootPath) return null;

  const node = findSectionNode(rootPath, pathname);
  // Путь вне дерева навигации (линейные маршруты вроде Пути Новобранца,
  // легаси-роуты) — HubNav не показываем, у таких страниц свой заголовок.
  if (!node && !fallbackTitle) return null;

  return (
    <div className="pt-7">
      <SectionHubNav
        rootPath={rootPath}
        variant="full"
        title={node?.label ?? fallbackTitle ?? ''}
        description={node?.description ?? fallbackDescription}
        iconUrl={node?.iconUrl ?? fallbackIconUrl}
        widthClass={widthClass}
      />
    </div>
  );
}
