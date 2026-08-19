import type { ReactNode } from 'react';
import { SectionLayoutNav } from '@/components/features/navigation/SectionLayoutNav';
import { DraftLayer } from '@/components/layout/DraftLayer';

// Единая навигация «Кодекса»: full-hubnav на ВСЕХ подстраницах (заголовок/иконка/кнопки из меню),
// как в «Прогрессе». На индексе (/eft/gamesetting) не рендерится — там карточки HubCard.
// Страницы больше НЕ верстают навигацию сами (hubnav-canon).
export default function CodexLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionLayoutNav rootPath="/eft/gamesetting" />
      {children}
      {/* Тумблер черновиков — Кодекс теперь редактируемый контент (E10, фаза 3). */}
      <DraftLayer />
    </>
  );
}
