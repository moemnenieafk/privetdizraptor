import type { ReactNode } from 'react';
import { SectionHubNav } from '@/components/features/navigation/SectionHubNav';

// Тонкая полоса-переключатель разделов «Кодекса» на детальных страницах (боссы/торговцы по slug).
// Индексные страницы и статьи рендерят свою навигацию сами (full-шапка / собственная полоса).
export default function CodexLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionHubNav rootPath="/eft/gamesetting" variant="bar" deepOnly />
      {children}
    </>
  );
}
