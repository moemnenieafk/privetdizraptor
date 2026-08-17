"use client";

import React, { useEffect, useMemo, useRef } from "react";
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaOptionsType } from 'embla-carousel';

type CarouselProps = {
  children: React.ReactNode;
  options?: EmblaOptionsType;
  /** Класс размера слайда. По умолчанию — крупные карточки главной (не менять для главной). */
  slideClassName?: string;
  /** Вертикальный паддинг вьюпорта (место под ховер-тени карточек). */
  viewportPadClassName?: string;
};

export const Carousel: React.FC<CarouselProps> = ({
  children,
  options,
  slideClassName = "flex-[0_0_80vw] sm:flex-[0_0_348px] mr-4 sm:mr-7",
  viewportPadClassName = "pt-[2.625rem] pb-24",
}) => {
  const emblaOptions: EmblaOptionsType = useMemo(() => ({
    loop: true,
    align: "center", // Карточка EFT будет по центру на всех экранах
    startIndex: 0,   // Явно указываем старт с первой карточки
    ...options,
  }), [options]);

  const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions);

  // На широких экранах (2К/ultrawide) суммарная ширина слайдов может не заполнять
  // вьюпорт — тогда Embla с loop:true не может разложить клоны и луп ломается/щёлкает
  // рывком. Включаем loop только когда контент реально шире вьюпорта; пересчитываем
  // на resize.
  const loopStateRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!emblaApi) return;

    const root = emblaApi.rootNode();
    const container = emblaApi.containerNode();

    const evaluateLoop = () => {
      const fits = container.scrollWidth > root.clientWidth + 1;
      const wantLoop = (emblaOptions.loop ?? false) && fits;
      if (loopStateRef.current === wantLoop) return;
      loopStateRef.current = wantLoop;
      emblaApi.reInit({ ...emblaOptions, loop: wantLoop });
    };

    evaluateLoop();
    const observer = new ResizeObserver(evaluateLoop);
    observer.observe(root);

    return () => observer.disconnect();
  }, [emblaApi, emblaOptions]);

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
        <div className={`embla__viewport cursor-grab active:cursor-grabbing w-full overflow-hidden ${viewportPadClassName}`} ref={emblaRef}>
          <div className="embla__container flex" style={{ backfaceVisibility: "hidden" }}>
            {React.Children.map(children, (child) => (
              <div className={`embla__slide ${slideClassName} min-w-0 flex justify-center`}>
                {child}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}