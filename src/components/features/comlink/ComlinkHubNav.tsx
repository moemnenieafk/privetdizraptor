'use client';

import { usePathname } from 'next/navigation';
import { SectionHubNav } from '@/components/features/navigation/SectionHubNav';
import { COMLINK_BASE, COMLINK_ICON, COMLINK_SECTIONS } from '@/data/comlinkSections';

// Единый двухколоночный HubNav раздела «Связь»: иконка+заголовок+описание слева,
// «Навигация по разделу» + кнопки переключения подразделов справа. Данные левого
// блока берутся из COMLINK_SECTIONS по активному сегменту пути. Служебные страницы
// (модерация) — в UTILITY. На индексе (/eft/comlink) не рендерится: там карточки HubCard.
const UTILITY: Record<string, { label: string; description: string }> = {
  reports: { label: 'Очередь жалоб', description: 'Модерация: разбор жалоб сообщества.' },
  verify: {
    label: 'Подтверждение профилей',
    description: 'Модерация: сверка скриншотов и выдача галочки в анкете.',
  },
};

export function ComlinkHubNav() {
  const pathname = usePathname();
  if (pathname === COMLINK_BASE) return null;

  const seg = pathname.slice(COMLINK_BASE.length).split('/').filter(Boolean)[0] ?? '';
  const section = COMLINK_SECTIONS.find((s) => s.slug === seg);
  const util = UTILITY[seg];

  return (
    <div className="pt-7">
      <SectionHubNav
        rootPath={COMLINK_BASE}
        variant="full"
        title={section?.label ?? util?.label ?? 'Связь'}
        description={section?.description ?? util?.description}
        iconUrl={section?.icon ?? COMLINK_ICON}
      />
    </div>
  );
}
