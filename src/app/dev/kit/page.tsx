import type { Metadata } from 'next';
import { KitClient } from './KitClient';

// Внутренний dev-роут (НЕ в меню, noindex): живой конструктор компонентов NIGHTFALL.
// Опора для сборки новых страниц «как конструктор» — сюда смотрим и указываем узлы.
export const metadata: Metadata = {
  title: 'UI-Кит · Конструктор | ЦТА dev',
  robots: { index: false, follow: false },
};

export default function KitPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <KitClient />
      </div>
    </main>
  );
}
