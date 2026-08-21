import { CraftWatcher } from '@/components/features/hideout/CraftWatcher';

export default function EftLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col w-full">
      {/* Глобальный вотчер готовности крафтов убежища — без UI, уведомления app-wide (спека §2). */}
      <CraftWatcher />
      {/* Фиксируем ширину всей страницы через 100vw. 
        Это гарантирует, что шапка займет одинаковую площадь 
        и на интерактивной карте квестов, и на страницах со скроллом.
      */}
      <style>{`
        html {
          width: 100vw !important;
          overflow-x: hidden !important;
        }
      `}</style>

      <div className="grow">
        {children}
      </div>
    </div>
  );
}