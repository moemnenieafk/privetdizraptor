'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import Footer from './Footer';
import StreamStatus from './header-modules/StreamStatus';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAccountRoute = pathname?.startsWith('/account');

  if (isAccountRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <StreamStatus />
      <main className="flex-grow flex flex-col w-full">{children}</main>
      <Footer />
    </>
  );
}
