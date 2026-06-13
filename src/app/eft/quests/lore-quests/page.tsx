import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Статичный список сюжетных заданий с путями иконок и описаниями
const STORY_QUESTS = [
  { id: 'q-tour', title: 'Тур', href: '/eft/quests/tour', iconPath: '/icons/eft/02-quests/story-tour.svg', description: 'Осмотритесь в Таркове. Нужно проверить несколько мест, где могут быть следы группы, которую я ищу.' },
  { id: 'q-heaven', title: 'Небеса в огне', href: '/eft/quests/heaven-on-fire', iconPath: '/icons/eft/02-quests/story-falling-skies.svg', description: 'На Таможне упал спутник. Сходи туда и разузнай, что к чему. Интересуют обломки, документы, любое оборудование.' },
  { id: 'q-ticket', title: 'Билет', href: '/eft/quests/ticket', iconPath: '/icons/eft/02-quests/story-the-ticket.svg', description: 'Помнишь тот спутник? Внутри него был важный груз, связанный с «Синим огнем». Мне нужно, чтобы ты нашел его.' },
  { id: 'q-batya', title: 'Батя', href: '/eft/quests/batya', iconPath: '/icons/eft/02-quests/story-batya.svg', description: 'Найди человека по имени Батя. Последний раз его видели в районе Леса. Говорят, он что-то раскопал про «Синий огонь».' },
  { id: 'q-unknowns', title: 'Неизвестные', href: '/eft/quests/unknowns', iconPath: '/icons/eft/02-quests/story-the-unheard.svg', description: 'В Таркове действует новая группа «Неизвестные». Собери о них как можно больше информации, ищи их следы и любые зацепки.' },
  { id: 'q-blue-fire', title: 'Синий Огонь', href: '/eft/quests/blue-fire', iconPath: '/icons/eft/02-quests/story-blue-fire.svg', description: 'Нужно выяснить, что такое «Синий огонь». Это связано с лабораторией «ТерраГруп». Проникни туда и найди любые данные.' },
  { id: 'q-already-here', title: 'Они уже здесь', href: '/eft/quests/already-here', iconPath: '/icons/eft/02-quests/story-they-are-already-here.svg', description: 'Плохие новости. «Неизвестные» уже в городе и начали действовать. Выясни их планы, ищи базы и склады, чтобы остановить их.' },
  { id: 'q-witness', title: 'Случайный свидетель', href: '/eft/quests/witness', iconPath: '/icons/eft/02-quests/story-accidental-witness.svg', description: 'Я нашел парня, который видел операцию «Неизвестных» на Развязке. Он напуган и прячется. Найди его и поговори с ним.' },
  { id: 'q-labyrinth', title: 'Лабиринт', href: '/eft/quests/labyrinth', iconPath: '/icons/eft/02-quests/story-the-labyrinth.svg', description: 'Свидетель рассказал, что «Неизвестные» искали что-то в подземных коммуникациях. Спустись туда и выясни, что именно.' },
  { id: 'q-boreas', title: 'Борей', href: '/eft/quests/boreas', iconPath: '/icons/eft/02-quests/story-boreas.svg', description: 'В лабиринте ты нашел данные о проекте «Борей». Это то, что искали «Неизвестные». Найди все, что связано с этим проектом.' }
];

export default function LoreQuestsPage() {

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-quests-lore-quests" />
        
        {/* Сетка Middle HubCard (по 3 в ряд) */}
        <div className="tactical-grid">
          {STORY_QUESTS.map((quest, index) => (
              <HubCard
                key={quest.id}
                gameId="eft"
                id={quest.id}
                title={quest.title}
                description={quest.description}
                href={quest.href}
                iconPath={quest.iconPath}
                variant="rectangle" // Прямоугольные карточки среднего размера
                index={index}
              />
          ))}
        </div>
      </div>
    </main>
  );
}