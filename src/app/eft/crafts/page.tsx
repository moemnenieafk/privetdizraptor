import { PageHeader } from '@/components/ui/PageHeader';
import Link from "next/link";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Тарков > КРАФТЫ > Каменизм",
  description: "Инструментарий для выживания в Escape from Tarkov",
};

export default function TarkovSubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[28px] pb-[56px] animate-[fade-in_0.5s_ease-out_both] min-h-[70vh]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0 mx-auto">
        <PageHeader pageId="eft-crafts" />
        <div className="w-full max-w-6xl mx-auto py-10 px-4">
      {/* Навигация назад */}
      <div className="mb-8">
        <Link 
          href="/tarkov" 
          className="text-[var(--primary)] font-mono text-xs uppercase tracking-widest hover:opacity-70 transition-opacity"
        >
          ← НАЗАД В ХАБ
        </Link>
      </div>

      {/* Контентная область в стиле Glassmorphism */}
      <div className="bg-kamen-stone/50 backdrop-blur-md border border-white/5 p-12 relative overflow-hidden">
        {/* Декоративный элемент Каменизма */}
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <span className="text-8xl font-black uppercase tracking-tighter">КАМЕНЬ</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-4">
            РАЗДЕЛ В РАЗРАБОТКЕ
          </h1>
          <div className="h-1 w-20 bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] mb-8" />
          <p className="text-text-muted font-mono text-sm uppercase tracking-widest leading-relaxed max-w-2xl">
            СИСТЕМА ФОРМИРУЕТСЯ
          </p>
          <p className="text-text-muted font-mono text-sm uppercase tracking-widest leading-relaxed max-w-2xl">
            ЗДЕСЬ БУДЕТ ЛАКОНИЧНЫЙ И ПОЛЕЗНЫЙ ИНСТРУМЕНТАРИЙ ДЛЯ КОМФОРТНОЙ ИГРЫ
          </p>
        </div>
      </div>
    </div>
        </div>
    </main>
  );
}