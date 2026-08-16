import React from 'react';
import { EftHomeHubClient } from '@/app/eft/EftHomeHubClient';

export default function EftHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        {/* Главная (R05): PageHeader + конструктор живут внутри клиента — шапка несёт edit-контролы.
            Набор и порядок — данные (feature-catalog); клиент выбирает роль из localStorage. */}
        <EftHomeHubClient />
      </div>
    </main>
  );
}
