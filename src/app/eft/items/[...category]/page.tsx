import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { notFound } from 'next/navigation';
import { HubCard } from '@/components/ui/HubCard';
import { HEADER_DICTIONARY, MenuItem } from '@/data/headerConfig';

interface Props {
  params: Promise<{ category: string[] }>;
}

// Вспомогательная функция для рекурсивного поиска узла в меню
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

export default async function ItemsDynamicPage({ params }: Props) {
  // В Next.js 15+ params является асинхронным (Promise), поэтому его нужно "дождаться"
  const resolvedParams = await params;
  
  // Собираем текущий путь из сегментов URL
  const currentPath = `/eft/items/${resolvedParams.category.join('/')}`;
  
  // Получаем дерево EFT меню
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  
  // Ищем текущий узел в конфигурации
  const currentNode = findNodeByPath(eftMenu, currentPath);

  if (!currentNode) {
    notFound(); // Если пути нет в конфиге, выдаем страницу 404
  }

  const hasChildren = currentNode.children && currentNode.children.length > 0;

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-[28px] pb-[56px]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        <PageHeader pageId="eft-items-[...category]" />

        {/* Рендер хаба (если есть вложенные пункты) или заглушка для таблицы */}
        {hasChildren ? (
          <div className="tactical-grid">
            {currentNode.children!.map((child, index) => (
              <HubCard 
                key={child.id} 
                gameId="eft" 
                id={child.id}
                title={child.label}
                description={`Подробная информация и предметы в категории «${child.label}».`}
                href={child.path || '#'}
                iconPath={child.iconUrl || child.iconUrlBear || ''}
                variant="rectangle"
                index={index} 
              />
            ))}
          </div>
        ) : (
          <div className="w-full flex items-center justify-center min-h-[300px] bg-[var(--color-card-menu)] border border-[var(--color-lines-hover)] rounded-lg p-8 text-center text-[var(--color-text-muted)]">
            Интерфейс таблицы предметов для "{currentNode.label}" находится в разработке.
          </div>
        )}
      </div>
    </main>
  );
}
