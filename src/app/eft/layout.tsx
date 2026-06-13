
export default function EftLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col w-full">
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

      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
}