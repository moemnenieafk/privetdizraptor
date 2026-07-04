'use client';

// Глобальный провайдер формы «Сообщить об ошибке»: даёт openFeedback() из любого места,
// монтирует модалку один раз. При открытии «намертво» фиксирует текущий URL страницы
// (можно переопределить явным аргументом). См. FeedbackModal (Figma 1588:1322).
import { createContext, useCallback, useContext, useState } from 'react';
import FeedbackModal from '@/components/layout/header-modules/FeedbackModal';

interface FeedbackCtx {
  openFeedback: (pageUrl?: string) => void;
}

const Ctx = createContext<FeedbackCtx | null>(null);

export function useFeedback(): FeedbackCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pageUrl, setPageUrl] = useState('');

  const openFeedback = useCallback((url?: string) => {
    setPageUrl(url ?? (typeof window !== 'undefined' ? window.location.href : ''));
    setOpen(true);
  }, []);

  return (
    <Ctx.Provider value={{ openFeedback }}>
      {children}
      <FeedbackModal isOpen={open} onClose={() => setOpen(false)} pageUrl={pageUrl} />
    </Ctx.Provider>
  );
}
