import type { Metadata } from 'next';
import { RookieHubClient } from './RookieHubClient';

export const metadata: Metadata = { title: 'Кто ты в Игре | Прогресс ЦТА' };

export default function RookieHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <RookieHubClient />
      </div>
    </main>
  );
}
