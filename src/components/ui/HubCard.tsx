import Link from "next/link";
import React from "react";
import { Tooltip } from "./Tooltip";

interface HubCardProps {
  gameId: string;         // ID родительской игры (например, 'eft')
  id: string;             // Идентификатор карточки (для подтягивания иконки {id}-icon.svg)
  title: string;          // Заголовок
  description?: string;   // Описание (опционально для табов)
  href: string;           // Ссылка
  badgeText?: string;     // Текст для бейджа в углу
  variant?: 'square' | 'rectangle' | 'mini' | 'tab'; // Адаптивный вид карточки
  index?: number;         // Индекс для каскадной анимации
  iconPath?: string;      // Явный путь к иконке (опционально)
  iconTooltip?: string;   // Текст тултипа для иконки
  isActive?: boolean;     // Активное состояние (для табов)
  onSelect?: () => void;  // Побочный эффект при клике (напр. запись XP) — не мешает навигации
}

export function HubCard({
  gameId,
  id,
  title,
  href,
  description = "",
  badgeText,
  variant = 'rectangle',
  index = 0,
  iconPath,
  iconTooltip,
  isActive = false,
  onSelect,
}: HubCardProps) {
  const isSquare = variant === 'square';
  const isMini = variant === 'mini';
  const isTab = variant === 'tab';

  // Хелпер: должна ли иконка сохранять свои оригинальные цвета (без CSS-маски)
  const isColoredIcon = (path?: string) => {
    if (!path) return false;
    if (path.endsWith('.webp') || path.endsWith('.png') || path.endsWith('.jpg')) return true;
    if (path.includes('/02-quests/')) return true; // Для иконок торговцев и квестов
    if (path.includes('/gun-modes/')) return true;
    return false;
  };

  // Динамические классы для трёх видов адаптивных карточек:
  // square 348² (2×2), rectangle 348×160 (2×1), mini 160² (1×1).
  const dimensions = isSquare
    ? 'w-full aspect-square md:col-span-2 md:row-span-2'
    : isMini
      ? 'w-full aspect-square'
      : 'w-full aspect-[348/160] md:col-span-2';

  const resolvedIconUrl = iconPath || `/icons/${gameId}/${id}-icon.svg`;

  // Mini (160²): компактный вид по референсу плитки карт — иконка по центру + подпись снизу,
  // без описания. Ховер как у остальных (border-primary).
  if (isMini) {
    return (
      <Link
        href={href}
        onClick={onSelect}
        className={`group relative flex flex-col items-center justify-center gap-4 bg-card-menu border border-lines-hover rounded-lg p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all duration-300 hover:border-primary/50 hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--primary)_15%,transparent)] hover:-translate-y-1 animate-[fade-in-up_0.6s_ease-out_both] ${dimensions}`}
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div className="size-10 transition-transform duration-300 group-hover:scale-110">
          {isColoredIcon(resolvedIconUrl) ? (

            <img src={resolvedIconUrl} alt="" className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
          ) : (
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
        <span className="text-center font-blender-medium text-type-micro sm:text-type-label uppercase tracking-widest text-text-primary group-hover:text-primary transition-colors">
          {title}
        </span>
      </Link>
    );
  }

  if (isTab) {
    return (
      <Link
        href={href}
        title={iconTooltip || title}
        className={`group w-fit shrink-0 px-3 h-8 border rounded inline-flex justify-center items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-(--primary) transition-all duration-200 hover:scale-105 active:scale-95 ${
          isActive 
            ? "border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary) shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_40%,transparent)]" 
            : "bg-card-menu border-lines-hover hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
        }`}
      >
        <div className="flex justify-start items-center overflow-hidden shrink-0">
          <div className="w-4 h-4 transition-transform duration-300">
            {isColoredIcon(resolvedIconUrl) ? (
               
              <img src={resolvedIconUrl} alt="" className={`w-full h-full object-contain transition-opacity ${isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"}`} />
            ) : (
              <div 
                className={`w-full h-full transition-colors duration-300 ${
                  isActive ? "bg-(--primary) opacity-100" : "bg-text-primary opacity-80 group-hover:opacity-100 group-hover:bg-(--primary)"
                }`}
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
        </div>
        <div className={`text-center justify-start text-xs font-blender-medium uppercase leading-4 tracking-widest transition-colors ${
          isActive ? "text-(--primary)" : "text-text-primary group-hover:text-(--primary)"
        }`}>
          {title}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onSelect}
      className={`group relative flex flex-col bg-card-menu border border-lines-hover rounded-lg overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all duration-300 hover:border-primary/50 hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--primary)_15%,transparent)] hover:-translate-y-1 animate-[fade-in-up_0.6s_ease-out_both] ${dimensions}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Иконка карточки с тултипом (с отступом 21px в правом верхнем углу) */}
      <div className="absolute top-5 right-5 z-10 w-8 h-8">
        <Tooltip 
          content={iconTooltip || title} 
          position="left" 
          className="w-full h-full flex items-center justify-center"
        >
          <div className="w-full h-full transition-transform duration-300 group-hover:scale-110">
            {isColoredIcon(resolvedIconUrl) ? (
               
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
        <div className="absolute top-6 left-6 text-type-caption font-blender-medium tracking-widest uppercase text-primary/50 group-hover:text-primary transition-colors">
          {badgeText}
        </div>
      )}

      {/* Текстовый блок (внизу) */}
      <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-1">
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