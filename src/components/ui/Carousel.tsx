"use client";

import React, { useEffect, useMemo } from "react";
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaOptionsType } from 'embla-carousel';

type CarouselProps = {
  children: React.ReactNode;
  options?: EmblaOptionsType;
};

export const Carousel: React.FC<CarouselProps> = ({ children, options }) => {
  const emblaOptions: EmblaOptionsType = useMemo(() => ({
    loop: true,
    align: "center", // Карточка EFT будет по центру на всех экранах
    startIndex: 0,   // Явно указываем старт с первой карточки
    ...options,
  }), [options]);

  const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions);

  useEffect(() => {
    if (!emblaApi) return;

    let time = Date.now();
    let accumDelta = 0; // Аккумулятор для сглаживания скролла тачпада

    const onWheel = (e: WheelEvent) => {
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);

      // Вертикальный скролл страницы не перехватываем
      if (!isHorizontal) return;

      e.preventDefault();

      const now = Date.now();
      if (now - time > 200) accumDelta = 0;
      time = now;

      accumDelta += e.deltaX;

      if (accumDelta > 50) {
        emblaApi.scrollNext();
        accumDelta = 0;
      } else if (accumDelta < -50) {
        emblaApi.scrollPrev();
        accumDelta = 0;
      }
    };

    const viewport = emblaApi.rootNode();
    // passive: false необходимо для работы e.preventDefault()
    viewport.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', onWheel);
    };
  }, [emblaApi]);

  return (
    <div className="relative w-full">
      <div className="embla w-full">
        {/* Вьюпорт должен быть на всю ширину экрана (w-full) с overflow-hidden, чтобы внутренний алгоритм 
            Embla правильно рассчитал количество клонируемых слайдов (loop) для краев больших мониторов */}
        <div className="embla__viewport cursor-grab active:cursor-grabbing w-full overflow-hidden py-[42px]" ref={emblaRef}>
          <div className="embla__container flex" style={{ backfaceVisibility: "hidden" }}>
            {React.Children.map(children, (child) => (
              <div className="embla__slide flex-[0_0_80vw] sm:flex-[0_0_348px] min-w-0 mr-[16px] sm:mr-[28px] flex justify-center">
                {/* Адаптивный размер: на мобилках 80vw и отступ 16px, на ПК строго 348px и 28px */}
                {child}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}