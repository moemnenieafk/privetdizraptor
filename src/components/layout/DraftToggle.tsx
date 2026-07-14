'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

// Переключатель режима черновика. Рендерится только для CMS-ролей (решает сервер).
// Включён → фиксированная плашка внизу: видно неопубликованные материалы.
// Выключен → неприметная кнопка в том же месте: «показать черновики».

interface Props {
  enabled: boolean;
}

export function DraftToggle({ enabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await fetch('/api/draft', { method: enabled ? 'DELETE' : 'POST' });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  const loading = busy || pending;

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="fixed bottom-4 left-4 z-50 flex h-11 items-center gap-2 rounded-xs border border-lines-hover bg-card-menu px-3 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        Черновики
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex h-11 items-center gap-3 rounded-xs border border-tactical-amber/60 bg-tactical-amber/15 px-3 backdrop-blur-sm">
      <span className="flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-tactical-amber">
        <span className="size-2 animate-pulse rounded-full bg-tactical-amber" />
        Режим черновика
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="flex h-8 items-center gap-1.5 rounded-xs border border-tactical-amber/50 px-2 font-blender-medium text-type-micro uppercase tracking-widest text-tactical-amber transition-colors hover:bg-tactical-amber/20 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
        Выйти
      </button>
    </div>
  );
}
