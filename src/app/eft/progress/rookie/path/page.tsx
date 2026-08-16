import type { Metadata } from 'next';
import { RookiePathClient } from './RookiePathClient';

export const metadata: Metadata = { title: 'Путь Новобранца | Аркады | ЦТА' };

export default function RookiePathPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <RookiePathClient />
      </div>
    </main>
  );
}
