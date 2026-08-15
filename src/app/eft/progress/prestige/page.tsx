import type { Metadata } from 'next';
import { PrestigeClient } from './PrestigeClient';

export const metadata: Metadata = { title: 'Престиж | Прогресс ЦТА' };

export default function PrestigePage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="text-[1.75rem] font-blender-medium uppercase tracking-widest text-text-primary">Престиж</h1>
          <p className="mt-2 text-sm text-text-secondary font-blender-book">
            Система престижа (PvP): требования, награды и что сбрасывается/переносится при переходе.
          </p>
        </header>
        <PrestigeClient />
      </div>
    </main>
  );
}
