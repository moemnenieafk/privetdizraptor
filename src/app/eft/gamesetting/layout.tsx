import type { ReactNode } from 'react';
import { SectionHubNav } from '@/components/features/navigation/SectionHubNav';

// Единый переключатель разделов «Кодекса» над всеми страницами (кроме хаба).
export default function CodexLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionHubNav rootPath="/eft/gamesetting" />
      {children}
    </>
  );
}
