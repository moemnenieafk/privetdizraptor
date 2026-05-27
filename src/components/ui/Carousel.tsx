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
      // Определяем доминирующую ось (X для свайпов на тачпаде, Y для колесика мыши)
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = isHorizontal ? e.deltaX : e.deltaY;

      // Блокируем скролл страницы и системные жесты "назад/вперед" в Safari
      e.preventDefault();

      const now = Date.now();
      // Если пауза между движениями больше 200мс, сбрасываем аккумулятор (гасит инерцию макбука)
      if (now - time > 200) {
        accumDelta = 0;
      }
      time = now;

      accumDelta += delta;

      // Порог в 50px защищает от "прыжков" на несколько карточек за один легкий свайп
      if (accumDelta > 50) {
        emblaApi.scrollNext();
        accumDelta = 0; // Сбрасываем после перелистывания
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
    <div className="relative w-full max-w-full md:max-w-[1100px] mx-auto">
      {/* Убрали overflow-hidden, чтобы карточки растекались по ширине на весь экран */}
      <div className="embla w-full">
        {/* Добавили overflow-visible и py-[42px] (84px в сумме) для достижения высоты карусели 648px */}
        <div className="embla__viewport cursor-grab active:cursor-grabbing w-full overflow-visible py-[42px]" ref={emblaRef}>
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