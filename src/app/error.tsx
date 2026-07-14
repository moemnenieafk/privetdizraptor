'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Граница ошибок сегмента: ловит рантайм-падения страниц внутри общего лэйаута
// (хедер/футер остаются). Каркас 500 в языке 404-страницы (NIGHTFALL).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[cta] unhandled error:', error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] w-full flex-col items-center justify-center pt-20 pb-25 animate-[fade-in_0.5s_ease-out_both]">
      <div className="flex w-full max-w-[800px] flex-col items-center px-4 text-center">

        <div className="relative mb-8 flex w-full items-center justify-center">
          <span className="select-none font-blender-medium text-[120px] leading-none text-lines-hover opacity-50 md:text-[200px]">
            500
          </span>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <h1 className="font-blender-medium text-3xl uppercase tracking-widest text-danger drop-shadow-[0_0_15px_rgba(200,60,60,0.35)] md:text-5xl">
              Связь потеряна
            </h1>
            <div className="mt-4 h-px w-50 bg-linear-to-r from-transparent via-danger to-transparent opacity-50" />
          </div>
        </div>

        <p className="mb-4 max-w-md font-blender-book text-sm text-text-secondary md:text-base">
          Модуль отвалился при обработке запроса. Телеметрия сбоя записана — попробуйте повторить
          операцию или вернуться в хаб.
        </p>

        {error.digest && (
          <p className="mb-10 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Код инцидента: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-md border border-lines-hover bg-card-menu px-8 py-3 transition-all duration-300 hover:border-(--primary) hover:shadow-[0_0_15px_rgba(230,142,37,0.2)]"
          >
            <div className="absolute inset-0 w-0 bg-(--primary) opacity-10 transition-all duration-300 ease-out group-hover:w-full" />
            <span className="relative z-10 font-blender-medium uppercase tracking-widest text-text-primary transition-colors duration-300 group-hover:text-(--primary)">
              Повторить
            </span>
          </button>

          <Link
            href="/eft"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-md border border-lines-hover bg-card-menu px-8 py-3 transition-all duration-300 hover:border-(--primary)"
          >
            <span className="relative z-10 font-blender-medium uppercase tracking-widest text-text-secondary transition-colors duration-300 group-hover:text-(--primary)">
              Вернуться в хаб
            </span>
          </Link>
        </div>

      </div>
    </main>
  );
}
