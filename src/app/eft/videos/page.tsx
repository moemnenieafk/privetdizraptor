import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Видео"
const VIDEOS_HUB_CARDS = [
  {
    id: 'guides',
    title: 'Гайды',
    description: 'Подробные видеоруководства по квестам, механикам и сборкам оружия.',
    href: '/eft/videos/guides',
    iconPath: '/icons/eft/06-videos/video-guides.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'advices',
    title: 'Советы',
    description: 'Короткие и полезные видеосоветы для новичков и опытных игроков.',
    href: '/eft/videos/advices',
    iconPath: '/icons/eft/06-videos/video-advices.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'news',
    title: 'Новости',
    description: 'Официальные новости, анонсы и обзоры обновлений от разработчиков.',
    href: '/eft/videos/news',
    iconPath: '/icons/eft/06-videos/video-news.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'streams',
    title: 'Стримы',
    description: 'Прямые трансляции и записи лучших игровых моментов от сообщества.',
    href: '/eft/videos/streams',
    iconPath: '/icons/eft/06-videos/live-streams.svg',
    variant: 'rectangle' as const,
  },
];

export default function VideosHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-[28px] pb-[56px]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        <PageHeader pageId="eft-videos" />
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {VIDEOS_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}