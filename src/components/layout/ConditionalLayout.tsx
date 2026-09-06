'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import Footer from './Footer';

/**
 * `pricingLink` — готовый серверный слот (ссылка «Тарифы» либо null), проброшенный сквозь
 * этот клиентский компонент в футер. Слотом, а не флагом: футер рендерится СНАРУЖИ
 * <GatingBoundary>, контекст гейтинга сюда не дотягивается, а читать флаг в корневом
 * layout нельзя — ломается пререндер (см. PricingFooterLink).
 */
export function ConditionalLayout({
  children,
  pricingLink = null,
}: {
  children: React.ReactNode;
  pricingLink?: React.ReactNode;
}) {
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
      {!hideFooter && <Footer pricingLink={pricingLink} />}
    </>
  );
}
