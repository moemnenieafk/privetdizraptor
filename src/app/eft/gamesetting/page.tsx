import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';
import { getSectionHubCards } from '@/lib/section-hub-nav';

// Карточки навигации раздела «Кодекс» строятся из HEADER_DICTIONARY (дети /eft/gamesetting),
// а не из локального массива: словарь — единственный источник и для верхней навигации, и для
// этой сетки. Убрал пункт из меню → карточка исчезла и здесь. Описания/иконки — из пунктов меню.
// Достижения и Престиж живут под /eft/progress/*, но в меню — дети «Кодекса» (карточки здесь).
const CODEX_HUB_CARDS = getSectionHubCards('/eft/gamesetting');

export default function CodexHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-4 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-gamesetting" />

        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {CODEX_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" variant="rectangle" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
