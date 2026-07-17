import { SectionHubNav } from '@/components/features/navigation/SectionHubNav';
import { DraftLayer } from '@/components/layout/DraftLayer';

// Layout раздела «Связь» — точка монтирования тумблера черновиков (E10, фаза 2).
//
// ПОЧЕМУ НЕ В КОРНЕВОМ LAYOUT: DraftLayer читает сессию (cookies) и роль из БД.
// В корневом layout это сделало бы динамическими ВСЕ страницы сайта и убило ISR
// (см. решение db-egress-reduction). Страницы «Связи» и так персональные
// (getMe в каждой), поэтому тумблер живёт здесь. Кодекс и истории получат его
// в своих фазах — либо общим content-layout, когда переедут в БД.
export default function ComlinkLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Верхняя навигация-переключатель подразделов «Связи»: единый источник —
          HEADER_DICTIONARY, сам вычисляется из rootPath+pathname. На индексе
          (/eft/comlink) не рендерится — там карточки-заглушка со своими табами. */}
      <SectionHubNav rootPath="/eft/comlink" variant="bar" />
      {children}
      <DraftLayer />
    </>
  );
}
