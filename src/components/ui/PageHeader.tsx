import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';

interface PageHeaderProps {
  pageId?: string;
  title?: string;
  description?: string;
  iconClass?: string;
}

export function PageHeader({ pageId, title, description, iconClass }: PageHeaderProps) {
  const content = pageId ? PAGE_CONTENT_DICTIONARY[pageId] : null;

  // Приоритет: Данные из словаря -> Явно переданные пропсы -> Дефолтные значения
  const finalTitle = content?.title || title || 'Раздел';
  const finalDesc = content?.description || description || '';
  const finalIcon = content?.iconClass || iconClass || 'icon-eft-items-loot-tier';

  return (
    <div className="flex items-center gap-5 mb-12">
      {/* Добавлен text-(--color-base) для инверсии цвета иконки */}
      <div className="flex-shrink-0 flex items-center justify-center w-[53px] h-[53px] rounded bg-(--primary) text-(--color-base)">
        <div className={`w-7 h-7 icon-mask ${finalIcon}`}></div>
      </div>
      <div>
        <h1 className="text-[28px] font-blender-medium leading-none tracking-tighter uppercase text-text-primary">{finalTitle}</h1>
        {finalDesc && <p className="mt-2 text-sm text-text-secondary max-w-2xl">{finalDesc}</p>}
      </div>
    </div>
  );
}
