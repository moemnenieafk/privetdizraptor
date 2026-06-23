import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';

// «Цена за слот». Статический маршрут перекрывает items/[...category],
// который иначе рендерит пустой каталог. Реал-калькулятор — Phase 2.1.
export default function PriceSlotPlaceholderPage() {
  const data = getSectionPlaceholder('/eft/items/price-slot');
  if (!data) notFound();
  return <SectionPlaceholder {...data} />;
}
