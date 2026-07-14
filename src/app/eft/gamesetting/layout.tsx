import type { ReactNode } from 'react';
import { SectionHubNav } from '@/components/features/navigation/SectionHubNav';
import { DraftLayer } from '@/components/layout/DraftLayer';

// Тонкая полоса-переключатель разделов «Кодекса» на детальных страницах (боссы/торговцы по slug).
// Индексные страницы и статьи рендерят свою навигацию сами (full-шапка / собственная полоса).
export default function CodexLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionHubNav rootPath="/eft/gamesetting" variant="bar" deepOnly />
      {children}
      {/* Тумблер черновиков — Кодекс теперь редактируемый контент (E10, фаза 3). */}
      <DraftLayer />
    </>
  );
}
