'use client';

import { useEffect } from 'react';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';

// Генерик-сеттер последней крошки для детальных страниц с BSG-id в URL
// (сырой id Breadcrumbs скрывает; этот компонент подставляет имя сущности).
// Пример: /eft/progress/achievements/<id> → «… / Достижения / <Имя достижения>».
export function DynamicCrumbSetter({ label }: { label: string }) {
  const setDynamicCrumbs = useBreadcrumbStore((s) => s.setDynamicCrumbs);
  const clearDynamicCrumbs = useBreadcrumbStore((s) => s.clearDynamicCrumbs);

  useEffect(() => {
    setDynamicCrumbs([{ label }]);
    return () => clearDynamicCrumbs();
  }, [label, setDynamicCrumbs, clearDynamicCrumbs]);

  return null;
}
