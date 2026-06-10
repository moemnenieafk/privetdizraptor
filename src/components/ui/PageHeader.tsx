import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';

interface PageHeaderProps {
  pageId: string;
}

export function PageHeader({ pageId }: PageHeaderProps) {
  const content = PAGE_CONTENT_DICTIONARY[pageId];

  if (!content) {
    // Заглушка на случай, если для страницы еще нет контента
    return (
      <div className="mb-12 text-center text-red-500">
        Контент для страницы с ID '{pageId}' не найден в `src/data/pageContent.ts`.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5 mb-12">
      <div className="flex-shrink-0 flex items-center justify-center w-[53px] h-[53px] rounded bg-[var(--primary)]">
        <div className={`w-7 h-7 icon-mask ${content.iconClass} text-base`} />
      </div>
      <div>
        <h1 className="text-[28px] font-blender-medium leading-none tracking-tighter">{content.title}</h1>
        <p className="mt-2 text-sm text-text-secondary max-w-2xl">{content.description}</p>
      </div>
    </div>
  );
}