"use client";

interface NewbieButtonProps {
  onClick?: () => void;
}

export default function NewbieButton({ onClick }: NewbieButtonProps) {
  return (
    <button 
      onClick={onClick}
      className="group relative flex h-[56px] w-[160px] cursor-pointer items-center justify-center focus:outline-none"
    >
      {/* 1. Радиальное свечение 160x56px */}
      <div className="absolute inset-0 opacity-30 transition-colors duration-300 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,_var(--color-text-secondary)_0%,_transparent_100%)] group-hover:bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,_var(--primary)_0%,_transparent_100%)]" />

      {/* 2. Градиентная обводка (Обертка 160x32px с p-[1px]) */}
      <div className="absolute top-1/2 flex h-[32px] w-[160px] -translate-y-1/2 items-center justify-center rounded bg-linear-to-r from-lines-hover via-text-secondary to-lines-hover p-[1px] transition-colors duration-300 group-hover:via-(--primary)">
        
        {/* 3. Внутренний фон кнопки (Строго #0D0D0F) */}
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[3px] bg-(--color-base)">
          
          {/* Hazard-полоски (внутри корпуса по краям) */}
          <div className="absolute left-1 top-0 h-full w-1.5 opacity-40 transition-colors duration-300 text-text-secondary group-hover:text-(--primary) group-hover:opacity-80 bg-[repeating-linear-gradient(-45deg,currentColor,currentColor_3px,transparent_3px,transparent_6px)]" />
          <div className="absolute right-1 top-0 h-full w-1.5 opacity-40 transition-colors duration-300 text-text-secondary group-hover:text-(--primary) group-hover:opacity-80 bg-[repeating-linear-gradient(-45deg,currentColor,currentColor_3px,transparent_3px,transparent_6px)]" />

          {/* 4. Левый блок: Анимация солдата (26x28px, Отступ слева 14px, прижат к низу) */}
          <div className="absolute bottom-0 left-[14px] h-[28px] w-[26px]">
            {/* Start Frame */}
            <div 
              className="icon-mask absolute inset-0 text-text-secondary transition-opacity duration-300 group-hover:opacity-0"
              style={{ maskImage: 'url(/icons/eft/soldier-animation-start-frame.svg)', WebkitMaskImage: 'url(/icons/eft/soldier-animation-start-frame.svg)', maskSize: 'contain', maskPosition: 'bottom center', maskRepeat: 'no-repeat' }}
            />
            {/* End Frame */}
            <div 
              className="icon-mask absolute inset-0 opacity-0 text-(--primary) transition-opacity duration-300 group-hover:opacity-100"
              style={{ maskImage: 'url(/icons/eft/soldier-animation-end-frame.svg)', WebkitMaskImage: 'url(/icons/eft/soldier-animation-end-frame.svg)', maskSize: 'contain', maskPosition: 'bottom center', maskRepeat: 'no-repeat' }}
            />
          </div>

          {/* 5. Правый блок: Силуэт города (76x28px, прижат вправо и вниз) */}
          <div className="absolute bottom-0 right-0 h-[28px] w-[76px]">
            {/* Default City */}
            <div 
              className="icon-mask absolute inset-0 text-text-secondary transition-opacity duration-300 group-hover:opacity-0"
              style={{ maskImage: 'url(/icons/eft/tarkov-city-bg-default.svg)', WebkitMaskImage: 'url(/icons/eft/tarkov-city-bg-default.svg)', maskSize: 'contain', maskPosition: 'bottom right', maskRepeat: 'no-repeat' }}
            />
            {/* Hover City */}
            <div 
              className="icon-mask absolute inset-0 opacity-0 text-(--primary) transition-opacity duration-300 group-hover:opacity-100"
              style={{ maskImage: 'url(/icons/eft/tarkov-city-bg-hover.svg)', WebkitMaskImage: 'url(/icons/eft/tarkov-city-bg-hover.svg)', maskSize: 'contain', maskPosition: 'bottom right', maskRepeat: 'no-repeat' }}
            />
          </div>

          {/* 6. Центр: Текст строго по центру (поверх всех абсолютных слоев) */}
          <span className="relative z-10 font-blender-medium text-[12px] uppercase tracking-wide text-text-secondary transition-colors duration-300 group-hover:text-(--primary)">
            Я НОВИЧОК
          </span>

        </div>
      </div>
    </button>
  );
}