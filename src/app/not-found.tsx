import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex w-full flex-col items-center justify-center pt-[80px] pb-[100px] animate-[fade-in_0.5s_ease-out_both] min-h-[70vh]">
      <div className="w-full max-w-[800px] px-4 flex flex-col items-center text-center">
        
        {/* Декоративный 404 на заднем плане с наложением заголовка */}
        <div className="relative w-full flex items-center justify-center mb-8">
          <span className="text-[120px] md:text-[200px] font-blender-medium leading-none text-[var(--color-lines-hover)] opacity-50 select-none">
            404
          </span>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <h1 className="text-3xl md:text-5xl font-blender-medium uppercase tracking-widest text-[var(--primary)] drop-shadow-[0_0_15px_rgba(230,142,37,0.4)]">
              Сектор в разработке
            </h1>
            <div className="h-[1px] w-[200px] bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent mt-4 opacity-50"></div>
          </div>
        </div>

        <p className="text-[var(--color-text-secondary)] max-w-md text-sm md:text-base font-blender-book mb-10">
          Запрашиваемые данные отсутствуют в базе, либо модуль находится на стадии проектирования. Ожидайте обновления пакетов телеметрии.
        </p>

        <Link 
          href="/eft"
          className="group relative inline-flex items-center justify-center px-8 py-3 bg-[var(--color-card-menu)] border border-[var(--color-lines-hover)] rounded-md overflow-hidden transition-all duration-300 hover:border-[var(--primary)] hover:shadow-[0_0_15px_rgba(230,142,37,0.2)]"
        >
          <div className="absolute inset-0 w-0 bg-[var(--primary)] transition-all duration-300 ease-out group-hover:w-full opacity-10"></div>
          <span className="relative z-10 text-[var(--color-text-primary)] group-hover:text-[var(--primary)] font-blender-medium uppercase tracking-widest transition-colors duration-300">
            Вернуться в хаб
          </span>
        </Link>

      </div>
    </main>
  );
}
