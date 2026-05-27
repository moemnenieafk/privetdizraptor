import Link from "next/link";
import React from "react";

interface HubCardProps {
  gameId: string;         // ID родительской игры (например, 'eft')
  id: string;             // Идентификатор карточки (для подтягивания иконки {id}-icon.svg)
  title: string;          // Заголовок
  description: string;    // Описание
  href: string;           // Ссылка
  badgeText?: string;     // Текст для бейджа в углу
  variant?: 'square' | 'rectangle'; // Адаптивный вид карточки
  index?: number;         // Индекс для каскадной анимации
}

export function HubCard({
  gameId,
  id,
  title,
  href,
  description,
  badgeText,
  variant = 'rectangle',
  index = 0,
}: HubCardProps) {
  const isSquare = variant === 'square';

  // Динамические классы для двух видов адаптивных карточек (348x348 и 348x160)
  const dimensions = isSquare
    ? 'w-full aspect-square md:w-[348px] md:h-[348px] md:row-span-2'
    : 'w-full aspect-[348/160] md:w-[348px] md:h-[160px]';

  return (
    <Link
      href={href}
      className={`group relative flex flex-col bg-card-menu border border-lines-hover rounded-lg overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-all duration-300 hover:border-primary/50 hover:shadow-[0_8px_30px_rgba(230,142,37,0.15)] hover:-translate-y-1 animate-[fade-in-up_0.6s_ease-out_both] ${dimensions}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Иконка карточки (с отступом 21px в правом верхнем углу) */}
      <div className="absolute top-[21px] right-[21px] w-[32px] h-[32px] transition-transform duration-300 group-hover:scale-110">
        {/* Используем CSS-маску для автоматического перекрашивания SVG в цвет текущей темы */}
        <div 
          className="w-full h-full bg-text-primary opacity-80 group-hover:opacity-100 group-hover:bg-[var(--primary)] transition-colors duration-300"
          style={{
            WebkitMaskImage: `url(/icons/${gameId}/${id}-icon.svg)`,
            WebkitMaskSize: 'contain',
            WebkitMaskPosition: 'center',
            WebkitMaskRepeat: 'no-repeat',
            maskImage: `url(/icons/${gameId}/${id}-icon.svg)`,
            maskSize: 'contain',
            maskPosition: 'center',
            maskRepeat: 'no-repeat',
          }}
        />
      </div>

      {/* Бейдж (смещен влево, чтобы не перекрывать иконку) */}
      {badgeText && (
        <div className="absolute top-[24px] left-[24px] text-[10px] font-blender-medium tracking-widest uppercase text-primary/50 group-hover:text-[var(--primary)] transition-colors">
          {badgeText}
        </div>
      )}

      {/* Текстовый блок (внизу) */}
      <div className="absolute bottom-[24px] left-[24px] right-[24px] flex flex-col gap-1">
        <h3 className="text-xl font-blender-medium uppercase tracking-wide text-text-primary group-hover:text-[var(--primary)] transition-colors">
          {title}
        </h3>
        <p className={`text-xs text-text-secondary leading-relaxed ${isSquare ? 'line-clamp-4' : 'line-clamp-2'}`}>
          {description}
        </p>
      </div>
    </Link>
  );
}