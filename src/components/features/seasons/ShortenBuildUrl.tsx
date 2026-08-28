'use client';

// Косметика адресной строки: если сборку открыли по длинному dot-коду, бесшумно
// заменяем URL на короткий slug (history.replaceState — без перезагрузки и записи в
// историю). Данные страницы не зависят от этого: и код, и slug ведут в один и тот же
// рендер (см. resolveBuild в page.tsx).
import { useEffect } from 'react';

export function ShortenBuildUrl({ slug }: { slug: string }) {
  useEffect(() => {
    const short = `/eft/progress/seasons/b/${slug}`;
    if (window.location.pathname !== short) {
      window.history.replaceState(null, '', short);
    }
  }, [slug]);
  return null;
}
