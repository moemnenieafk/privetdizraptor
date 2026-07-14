import { DraftLayer } from '@/components/layout/DraftLayer';

// Layout раздела «Задания» — точка монтирования тумблера черновиков: сюжетные гайды
// стали редактируемым контентом (E10, фаза 5). В корневой layout DraftLayer не ставим
// осознанно — он читает cookies и БД, и это сделало бы динамическим весь сайт.
export default function QuestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DraftLayer />
    </>
  );
}
