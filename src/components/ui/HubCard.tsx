import Link from "next/link";
import React from "react";
import { Tooltip } from "./Tooltip";

interface HubCardProps {
  gameId: string;         // ID родительской игры (например, 'eft')
  id: string;             // Идентификатор карточки (для подтягивания иконки {id}-icon.svg)
  title: string;          // Заголовок
  description: string;    // Описание
  href: string;           // Ссылка
  badgeText?: string;     // Текст для бейджа в углу
  variant?: 'square' | 'rectangle'; // Адаптивный вид карточки
  index?: number;         // Индекс для каскадной анимации
  iconPath?: string;      // Явный путь к иконке (опционально)
  iconTooltip?: string;   // Текст тултипа для иконки
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
  iconPath,
  iconTooltip,
}: HubCardProps) {
  const isSquare = variant === 'square';

  // Хелпер: должна ли иконка сохранять свои оригинальные цвета (без CSS-маски)
  const isColoredIcon = (path?: string) => {
    if (!path) return false;
    if (path.endsWith('.webp') || path.endsWith('.png') || path.endsWith('.jpg')) return true;
    if (path.includes('/02-quests/')) return true; // Для иконок торговцев и квестов
    if (path.includes('/gun-modes/')) return true;
    return false;
  };

  // Динамические классы для двух видов адаптивных карточек (348x348 и 348x160)
  const dimensions = isSquare
    ? 'w-full aspect-square md:w-[348px] md:h-[348px] md:col-span-2 md:row-span-2'
    : 'w-full aspect-[348/160] md:w-[348px] md:h-[160px] md:col-span-2';

  const resolvedIconUrl = iconPath || `/icons/${gameId}/${id}-icon.svg`;

  return (
    <Link
      href={href}
      className={`group relative flex flex-col bg-card-menu border border-lines-hover rounded-lg overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all duration-300 hover:border-primary/50 hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--primary)_15%,transparent)] hover:-translate-y-1 animate-[fade-in-up_0.6s_ease-out_both] ${dimensions}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Иконка карточки с тултипом (с отступом 21px в правом верхнем углу) */}
      <div className="absolute top-[21px] right-[21px] z-10 w-[32px] h-[32px]">
        <Tooltip 
          content={iconTooltip || title} 
          position="left" 
          className="w-full h-full flex items-center justify-center"
        >
          <div className="w-full h-full transition-transform duration-300 group-hover:scale-110">
            {isColoredIcon(resolvedIconUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolvedIconUrl} alt="" className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
            ) : (
              /* Используем CSS-маску для автоматического перекрашивания SVG в цвет текущей темы */
              <div 
                className="w-full h-full bg-text-primary opacity-80 group-hover:opacity-100 group-hover:bg-primary transition-colors duration-300"
                style={{
                  WebkitMaskImage: `url(${resolvedIconUrl})`,
                  WebkitMaskSize: 'contain',
                  WebkitMaskPosition: 'center',
                  WebkitMaskRepeat: 'no-repeat',
                  maskImage: `url(${resolvedIconUrl})`,
                  maskSize: 'contain',
                  maskPosition: 'center',
                  maskRepeat: 'no-repeat',
                }}
              />
            )}
          </div>
        </Tooltip>
      </div>

      {/* Бейдж (смещен влево, чтобы не перекрывать иконку) */}
      {badgeText && (
        <div className="absolute top-[24px] left-[24px] text-[10px] font-blender-medium tracking-widest uppercase text-primary/50 group-hover:text-primary transition-colors">
          {badgeText}
        </div>
      )}

      {/* Текстовый блок (внизу) */}
      <div className="absolute bottom-[24px] left-[24px] right-[24px] flex flex-col gap-1">
        <h3 className="text-xl font-blender-medium uppercase tracking-wide text-text-primary group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className={`text-xs text-text-secondary leading-relaxed ${isSquare ? 'line-clamp-4' : 'line-clamp-2'}`}>
          {description}
        </p>
      </div>
    </Link>
  );
}