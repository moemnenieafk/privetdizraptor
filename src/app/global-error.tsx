'use client';

import './globals.css';

// Последний рубеж: ловит ошибки самого корневого лэйаута (когда error.tsx уже не работает).
// Обязан рендерить собственные <html>/<body> — стили и провайдеры недоступны.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body className="flex min-h-screen items-center justify-center bg-base antialiased">
        <main className="flex w-full max-w-lg flex-col items-center px-4 text-center">
          <span className="select-none font-blender-medium text-[7.5rem] leading-none text-lines-hover opacity-50">
            500
          </span>
          <h1 className="font-blender-medium text-3xl uppercase tracking-widest text-danger">
            Критический сбой
          </h1>
          <p className="mt-4 font-blender-book text-sm text-text-secondary">
            Приложение не смогло инициализироваться. Перезагрузите страницу.
            {error.digest ? ` Код инцидента: ${error.digest}` : ''}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-md border border-lines-hover bg-card-menu px-8 py-3 font-blender-medium uppercase tracking-widest text-text-primary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Перезагрузить
          </button>
        </main>
      </body>
    </html>
  );
}
