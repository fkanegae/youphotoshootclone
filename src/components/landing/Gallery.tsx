"use client";

import Image from "next/image";
import { useEffect, useCallback, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  EmblaCarouselType,
  EmblaEventType,
  EmblaOptionsType,
} from "embla-carousel";
import Autoplay from "embla-carousel-autoplay";
import { NextButton, PrevButton, useCarouselButtons } from "./carousel-button";

const CarouselSlidesData = [
  {
    id: 1,
    text: "The photos turned out amazing! Happy with the results.",
    name: "I. Gil",
    role: "HR Business Partner",
    image: "/testimonials/testimonial1.webp",
  },
  {
    id: 2,
    text: "Just in awe of the results, it was just so fast and easy to get the photos I needed.",
    name: "L. Lima",
    role: "Sustainable Finance",
    image: "/testimonials/testimonial2.jpg",
  },
  {
    id: 3,
    text: "I was skeptical at first, but the results blew me away. Highly recommend!",
    name: "S. Valderrama",
    role: "Consultant",
    image: "/testimonials/testimonial3.png",
  },
  {
    id: 4,
    text: "Perfect for my LinkedIn profile.",
    name: "G. Kanegae",
    role: "Project Manager",
    image: "/testimonials/testimonial4.jpeg",
  },
  {
    id: 5,
    text: "The whole process was so easy and fun. Love how the photos turned out!",
    name: "E. Ressler",
    role: "Talent Acquisition",
    image: "/testimonials/testimonial5.jpg",
  },
];

type EmblaCarouselPropType = {
  className?: string;
  slides: React.ReactNode[];
  options?: EmblaOptionsType;
  autoplay?: boolean;
  autoplayDelay?: number;
  maxTranslateY?: number;
  tweenFactorBase?: number;
};

const TWEEN_FACTOR_BASE = 0.4;
const MAX_TRANSLATE_Y = 120;

const numberWithinRange = (number: number, min: number, max: number): number =>
  Math.min(Math.max(number, min), max);

const EmblaCarousel: React.FC<EmblaCarouselPropType> = (props) => {
  const {
    slides,
    options,
    className,
    autoplay = true,
    autoplayDelay = 2000,
  } = props;

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      ...options,
      containScroll: "trimSnaps",
      align: "center"
    },
    autoplay
      ? [Autoplay({ delay: autoplayDelay, stopOnInteraction: false })]
      : []
  );

  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = useCarouselButtons(emblaApi);

  return (
    <div className="relative w-full">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {slides.map((slide, index) => (
            <div
              className="min-w-[100%] sm:min-w-[85%] md:min-w-[45%] pl-4 relative"
              key={index}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 py-6">
        <PrevButton
          className="w-10 h-10 bg-mainBlack text-mainWhite rounded-full flex items-center justify-center hover:bg-mainBlack/80 transition-colors"
          onClick={onPrevButtonClick}
          disabled={prevBtnDisabled}
        />
        <NextButton
          className="w-10 h-10 bg-mainBlack text-mainWhite rounded-full flex items-center justify-center hover:bg-mainBlack/80 transition-colors"
          onClick={onNextButtonClick}
          disabled={nextBtnDisabled}
        />
      </div>
    </div>
  );
};

const Gallery = () => {
  const OPTIONS: EmblaOptionsType = { loop: true };
  const slides = CarouselSlidesData.map((testimonial) => (
    <div
      key={testimonial.id}
      className="h-[400px] sm:h-[450px] md:h-[500px] lg:h-[600px] relative mx-2 sm:mx-4"
    >
      <Image
        src={testimonial.image}
        alt={testimonial.name}
        fill
        className="object-cover rounded-lg sm:rounded-2xl shadow-lg"
        sizes="(max-width: 640px) 90vw, (max-width: 768px) 85vw, 45vw"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-lg sm:rounded-2xl" />
      <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 flex flex-col gap-2">
        <p className="text-sm sm:text-base md:text-lg text-white font-medium line-clamp-3">
          {testimonial.text}
        </p>
        <div className="flex flex-col">
          <p className="text-white font-semibold text-xs sm:text-sm md:text-base">
            {testimonial.name}
          </p>
          <p className="text-white/90 text-xs sm:text-sm">
            {testimonial.role}
          </p>
        </div>
      </div>
    </div>
  ));

  return (
    <section className="w-full py-8 sm:py-12 md:py-16 bg-mainWhite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tighter text-center mb-6 sm:mb-8 md:mb-12 text-mainBlack">
          What Our Customers Say
        </h2>
        <EmblaCarousel
          slides={slides}
          options={OPTIONS}
          autoplayDelay={3000}
          className="w-full"
        />
      </div>
    </section>
  );
};

export default Gallery;
