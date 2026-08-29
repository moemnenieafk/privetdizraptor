import Link from "next/link";
import Image from "next/image";

interface PlaceholderPageProps {
  themeClass: string;
  logoSrc: string;
  logoAlt: string;
  description: string;
  bgImage?: string;
  bgVideo?: string;
}

export function PlaceholderPage({ themeClass, logoSrc, logoAlt, description, bgImage, bgVideo }: PlaceholderPageProps) {
  return (
    <main className={`min-h-screen bg-base flex flex-col items-center justify-center relative overflow-hidden ${themeClass}`}>
      {/* 1. Статичное фоновое изображение (бэкап) */}
      {bgImage && (
        <Image 
          src={bgImage} 
          alt={`${logoAlt} background`} 
          fill 
          className="object-cover opacity-40 pointer-events-none z-0" 
          priority 
        />
      )}
      
      {/* 2. Фоновое видео (перекрывает изображение) */}
      {bgVideo && (
        <video 
          src={bgVideo} 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none z-0" 
        />
      )}

      {/* 3. Градиентная маска для читаемости текста и плавного слияния с цветом base */}
      <div className="absolute inset-0 bg-linear-to-b from-base/50 via-base/80 to-base z-0 pointer-events-none" />

      {/* Фоновое свечение в акцентном цвете темы */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[18.75rem] h-[18.75rem] md:w-[25rem] md:h-[25rem] bg-primary/15 rounded-full blur-[80px] md:blur-[100px] pointer-events-none transition-all duration-700 z-0"></div>
      
      <div className="relative z-10 flex flex-col items-center p-6 text-center">
        {/* Логотип игры */}
        <div className="w-[10rem] h-[3rem] md:w-[12.5rem] md:h-[3.75rem] relative mb-6 md:mb-8 animate-[fade-in-up_1s_both]">
          <Image 
            src={logoSrc} 
            alt={logoAlt} 
            fill 
            className="object-contain"
          />
        </div>

        {/* Адаптивный размер текста для самых маленьких экранов */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-blender-medium uppercase tracking-widest text-text-primary mb-3 md:mb-4 animate-[fade-in-up_1s_both]" style={{ animationDelay: '100ms' }}>
          В разработке
        </h1>
        
        <p className="text-text-muted text-xs sm:text-sm tracking-[0.15em] sm:tracking-[0.2em] uppercase mb-8 md:mb-10 max-w-[17.5rem] sm:max-w-md animate-[fade-in-up_1s_both]" style={{ animationDelay: '200ms' }}>
          {description}
        </p>

        <Link 
          href="/" 
          className="px-6 py-3 md:px-8 bg-card-menu border border-lines-hover text-text-secondary hover:text-primary hover:border-primary transition-all uppercase tracking-widest text-type-caption sm:text-xs rounded-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] outline-none focus-visible:ring-2 focus-visible:ring-primary animate-[fade-in-up_1s_both]"
          style={{ animationDelay: '300ms' }}
        >
          Вернуться в хаб
        </Link>
      </div>
    </main>
  );
}