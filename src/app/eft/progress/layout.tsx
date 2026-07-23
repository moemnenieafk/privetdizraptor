import { SectionLayoutNav } from '@/components/features/navigation/SectionLayoutNav';

/**
 * Layout раздела «Прогресс» — точка монтирования верхней навигации подразделов.
 *
 * Раньше HubNav не было ни на одной странице раздела: каждая новая подстраница
 * добавлялась без него. Теперь навигация приходит из layout и покрывает все
 * подразделы разом. Не рендерится на индексе (/eft/progress) — там сетка
 * HubCard — и на путях вне дерева меню (этапы Пути Новобранца, легаси-роуты):
 * fallbackTitle намеренно не задан.
 */
export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionLayoutNav rootPath="/eft/progress" />
      {children}
    </>
  );
}
