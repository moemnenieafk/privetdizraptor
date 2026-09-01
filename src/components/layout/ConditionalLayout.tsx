'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import Footer from './Footer';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Собственная «голая» хром-зона (свой хедер, без глобального навбара/футера): Аккаунт-центр и CMS-панель.
  const isBareChrome = pathname?.startsWith('/account') || pathname?.startsWith('/admin');

  if (isBareChrome) {
    return <>{children}</>;
  }

  const hideFooter = pathname?.startsWith('/eft/questmap') || pathname?.startsWith('/eft/maps');

  return (
    <>
      <Header />
      <main className="flex-grow flex flex-col w-full">{children}</main>
      {!hideFooter && <Footer />}
    </>
  );
}
