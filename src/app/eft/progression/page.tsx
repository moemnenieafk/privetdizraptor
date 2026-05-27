import { HubCard } from '@/components/ui/HubCard';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Прогресс | EFT | ЦТА",
  description: "Отслеживание достижений, предметов и прогресса в Escape from Tarkov.",
};

export default function ProgressionPage() {
  return (
    <div className="w-full max-w-[1100px] mx-auto py-10 px-4">
      
      {/* Заголовок страницы с анимацией появления */}
      <div className="mb-12 animate-[fade-in-up_0.4s_ease-out_both]">
        <h1 className="text-2xl font-blender-medium tracking-[0.3em] uppercase text-text-primary mb-2">
          ПРОГРЕСС <span className="text-primary">EFT</span>
        </h1>
        <p className="text-[10px] font-bold tracking-widest text-text-muted uppercase">
          Вложенный уровень: инструменты для отслеживания игровых достижений и лута
        </p>
      </div>

      {/* Сетка вложенных карточек */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[28px] md:auto-rows-[160px] justify-items-center">
        <HubCard
          gameId="eft"
          id="achievements"
          href="/eft/achievements"
          title="Достижения"
          description="Секретные и сюжетные награды"
          //variant="square"
          index={0}
        />
        <HubCard
          gameId="eft"
          id="itemtracker"
          href="/eft/tracker"
          title="Трекер предметов"
          description="Интерактивный список предметов для заданий"
          //variant="square"
          index={1}
        />
        <HubCard
          gameId="eft"
          id="keepitems"
          href="/eft/keepitems"
          title="Нужные предметы"
          description="Что нужно оставить для Каппы и Убежища"
          index={2}
        />
      </div>
    </div>
  );
}