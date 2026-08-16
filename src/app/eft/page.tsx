import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { EftHomeHubClient } from '@/app/eft/EftHomeHubClient';

export default function EftHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft" />

        {/* Главная (R05): избранный набор активного архетипа как HubCard'ы (Карты — крупной плиткой).
            Набор и порядок — данные (feature-catalog); клиент выбирает роль из localStorage. */}
        <EftHomeHubClient />

      </div>
    </main>
  );
}
