import { ComlinkHubNav } from '@/components/features/comlink/ComlinkHubNav';
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
      {/* Единый двухколоночный HubNav подразделов «Связи» (иконка+заголовок+описание |
          навигация по разделу). На индексе (/eft/comlink) не рендерится — там HubCard. */}
      <ComlinkHubNav />
      {children}
      <DraftLayer />
    </>
  );
}
