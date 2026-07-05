'use client';

import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggle = () => setIsVisible(window.scrollY > 350);
    window.addEventListener('scroll', toggle, { passive: true });
    return () => window.removeEventListener('scroll', toggle);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Прокрутить наверх"
      className={`fixed bottom-18 right-4 z-50 flex items-center gap-1.5 rounded border px-3 py-2 font-blender-medium text-xs uppercase tracking-widest shadow-lg backdrop-blur-sm transition-all duration-300 sm:right-8
        bg-[color-mix(in_srgb,var(--color-base)_90%,transparent)] border-lines-hover text-text-muted
        hover:border-(--primary) hover:text-(--primary) hover:shadow-[0_0_16px_color-mix(in_srgb,var(--primary)_25%,transparent)]
        ${isVisible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}
    >
      <ChevronUp className="h-4 w-4 shrink-0" />
      Наверх
    </button>
  );
}
