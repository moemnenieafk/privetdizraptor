import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export default function EftLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
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

      {/* Единый глобальный заголовок, который сам понимает, в какой игре находится */}
      
      <main className="flex-grow">
        <Breadcrumbs />
        {children}
      </main>
    </div>
  );
}