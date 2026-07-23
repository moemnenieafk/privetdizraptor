import type { Metadata } from 'next';
import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { HubCard } from '@/components/ui/HubCard';
import { getSectionHubCards } from '@/lib/section-hub-nav';

export const metadata: Metadata = { title: 'Прогресс | ЦТА' };

// Карточки навигации раздела строятся из HEADER_DICTIONARY (дети /eft/progress),
// а не из локального массива: словарь остаётся единственным источником правды
// и для верхней навигации (HubNav), и для этой сетки.
// Достижения и Престиж переехали в «Кодекс» (/eft/gamesetting) — карточки там.
const PROGRESS_HUB_CARDS = getSectionHubCards('/eft/progress');

export default function ProgressHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-progress" />

        {/* Сетка HubCard — навигация по разделу */}
        <div className="tactical-grid">
          {PROGRESS_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" variant="rectangle" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
