import type { Metadata } from 'next';
import { AdaptiveHubClient } from '@/components/features/adaptive/AdaptiveHubClient';

export const metadata: Metadata = { title: 'Мой хаб | ЦТА' };

export default function AdaptiveHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="text-[1.75rem] font-blender-medium uppercase tracking-widest text-text-primary">Мой хаб</h1>
          <p className="mt-2 text-sm font-blender-book text-text-secondary">
            Центр Тактической Адаптации подстраивается под тебя. Выбери роль или доверься авто-подбору — портал соберёт
            нужное.
          </p>
        </header>
        <AdaptiveHubClient />
      </div>
    </main>
  );
}
