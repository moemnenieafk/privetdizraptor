import { HubCard } from '@/components/ui/HubCard';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ЦТА | Центр Тактической Адаптации",
  description: "Минимум шансов на ошибку. Максимальная тактическая готовность в любых условиях в Escape from Tarkov.",
};

export default function EftPage() {
  return (
    <div className="w-full max-w-[1100px] mx-auto py-10 px-4">
      

      {/* ОСНОВНАЯ СЕТКА */}
      {/* auto-rows-[160px] гарантирует высоту "прямоугольников". Квадраты займут row-span-2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[28px] md:auto-rows-[160px] justify-items-center">
        
        {/* КАРТЫ (Левый большой блок) */}
        <HubCard
          gameId="eft"
          id="maps"
          href="/eft/maps"
          title="Карты"
          description="Интерактивные топографические данные"
          //badgeText="[Интерактив]"
          variant="square"
          index={0}
        />

        {/* КВЕСТЫ (Правый верхний, на 2 колонки) */}
        <HubCard
          gameId="eft"
          id="quests"
          href="/eft/quests"
          title="Задания"
          description="Подробные инструкции выполнения задач"
          //badgeText="[!]"
          index={1}
        />
        
        {/* СНАРЯЖЕНИЕ */}
        <HubCard
          gameId="eft"
          id="gear"
          href="/eft/gear"
          title="Снаряжение"
          description="Рекомендации по подбору экипировки"
          index={2}
        />
        
        {/* ПАТРОНЫ */}
        <HubCard
          gameId="eft"
          id="ammo"
          href="/eft/ammo"
          title="Патроны"
          description="Эффективность пробития боеприпасов"
          index={3}
        />

        {/* СБОРКИ ОРУЖИЯ */}
        <HubCard
          gameId="eft"
          id="weapons"
          href="/eft/weapons"
          title="СБОРКИ"
          description="Рекомендуемые сборки оружия"
          index={4}
        />
        
        {/* КРАФТЫ */}
        <HubCard
          gameId="eft"
          id="crafts"
          href="/eft/crafts"
          title="Крафты"
          description="Выгодные крафты в убежище ЧВК"
          index={5}
        />

        {/* БАРТЕРЫ */}
        <HubCard
          gameId="eft"
          id="barters"
          href="/eft/barters"
          title="Бартеры"
          description="Прибыльный обмен предметов у торговцев"
          index={6}
        />

        {/* УБЕЖИЩЕ */}
        <HubCard
          gameId="eft"
          id="hideout"
          href="/eft/hideout"
          title="Убежище"
          description="Точный учет необходимых предметов"
          index={7}
        />

        {/* СЮЖЕТ */}
        <HubCard
          gameId="eft"
          id="lore"
          href="/eft/lore"
          title="СЮЖЕТ"
          description="Подробная хронология событий и синопсис игры"
          index={8}
        />

        {/* ПРОГРЕСС */}
        <HubCard
          gameId="eft"
          id="progression"
          href="/eft/progression"
          title="Прогресс"
          description="Интерактивные инструменты для отслеживания прогресса в игре"
          index={9}
        />

        {/* ВИДЕО */}
        <HubCard
          gameId="eft"
          id="videos"
          href="/eft/videos"
          title="ВИДЕО"
          description="Актуальные видео по игре, гайды, новости"
          index={10}
        />

      </div>
    </div>
  );
}