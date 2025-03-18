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
    text: "The photos turned out amazing! The AI really captured my style.",
    name: "Sarah Johnson",
    role: "Marketing Professional",
    image: "/testimonials/demo1-ai.webp",
  },
  {
    id: 2,
    text: "Incredible value for money. Professional photos without the professional price tag.",
    name: "Michael Chen",
    role: "Software Engineer",
    image: "/testimonials/demo2-ai.webp",
  },
  {
    id: 3,
    text: "I was skeptical at first, but the results blew me away. Highly recommend!",
    name: "Emma Rodriguez",
    role: "Content Creator",
    image: "/testimonials/demo3-ai.webp",
  },
  {
    id: 4,
    text: "Perfect for my LinkedIn profile. Got so many compliments on my new photos.",
    name: "James Wilson",
    role: "Business Consultant",
    image: "/testimonials/demo4-ai.webp",
  },
  {
    id: 5,
    text: "The whole process was so easy and fun. Love how the photos turned out!",
    name: "Lisa Thompson",
    role: "Freelance Designer",
    image: "/testimonials/demo5-ai.webp",
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
    maxTranslateY = MAX_TRANSLATE_Y,
    tweenFactorBase = TWEEN_FACTOR_BASE,
  } = props;

  const [emblaRef, emblaApi] = useEmblaCarousel(
    options,
    autoplay
      ? [Autoplay({ delay: autoplayDelay, stopOnInteraction: false })]
      : []
  );
  const tweenFactor = useRef(0);
  const tweenNodes = useRef<HTMLElement[]>([]);

  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = useCarouselButtons(emblaApi);

  const setTweenNodes = useCallback((emblaApi: EmblaCarouselType): void => {
    tweenNodes.current = emblaApi.slideNodes().map((slideNode: HTMLElement) => {
      return slideNode.querySelector(".embla__slide__number") as HTMLElement;
    });
  }, []);

  const setTweenFactor = useCallback((emblaApi: EmblaCarouselType) => {
    tweenFactor.current = tweenFactorBase * emblaApi.scrollSnapList().length;
  }, []);

  const tweenTranslate = useCallback(
    (emblaApi: EmblaCarouselType, eventName?: EmblaEventType) => {
      const engine = emblaApi.internalEngine();
      const scrollProgress = emblaApi.scrollProgress();
      const slidesInView = emblaApi.slidesInView();
      const isScrollEvent = eventName === "scroll";

      emblaApi
        .scrollSnapList()
        .forEach((scrollSnap: number, snapIndex: number) => {
          let diffToTarget = scrollSnap - scrollProgress;
          const slidesInSnap = engine.slideRegistry[snapIndex];

          slidesInSnap.forEach((slideIndex: number) => {
            if (isScrollEvent && !slidesInView.includes(slideIndex)) return;

            if (engine.options.loop) {
              engine.slideLooper.loopPoints.forEach((loopItem: any) => {
                const target = loopItem.target();

                if (slideIndex === loopItem.index && target !== 0) {
                  const sign = Math.sign(target);

                  if (sign === -1) {
                    diffToTarget = scrollSnap - (1 + scrollProgress);
                  }
                  if (sign === 1) {
                    diffToTarget = scrollSnap + (1 - scrollProgress);
                  }
                }
              });
            }

            const tweenValue = Math.abs(diffToTarget * tweenFactor.current);
            const translateY = numberWithinRange(
              tweenValue * maxTranslateY,
              0,
              maxTranslateY
            );

            const opacity = numberWithinRange(1 - tweenValue * 0.5, 0.5, 1);

            const tweenNode = tweenNodes.current[slideIndex];
            tweenNode.style.transform = `translateY(${translateY}px)`;
            tweenNode.style.opacity = opacity.toString();
          });
        });
    },
    []
  );

  useEffect(() => {
    if (!emblaApi) return;

    setTweenNodes(emblaApi);
    setTweenFactor(emblaApi);
    tweenTranslate(emblaApi);

    emblaApi
      .on("reInit", setTweenNodes)
      .on("reInit", setTweenFactor)
      .on("reInit", tweenTranslate)
      .on("scroll", tweenTranslate);
  }, [emblaApi, setTweenFactor, setTweenNodes, tweenTranslate]);

  return (
    <div className="relative">
      <div className="py-10 overflow-visible" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, index) => (
            <div
              className="max-[350px]:[flex:0_0_18rem] [flex:0_0_20rem] flex pl-4"
              key={index}
            >
              <div
                className={`embla__slide__number w-full flex items-center justify-center h-full ${
                  className || ""
                }`}
              >
                <div className="h-full w-full">
                  <div className="group relative z-0 h-full w-full overflow-hidden rounded">
                    <div className="overflow-hidden rounded h-full w-full">
                      {slide}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 py-10">
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
  const OPTIONS: EmblaOptionsType = { loop: true, align: "center" };
  const slides = CarouselSlidesData.map((testimonial) => (
    <div
      key={testimonial.id}
      className="relative flex-[0_0_100%] sm:flex-[0_0_90%] md:flex-[0_0_40%] h-[300px] sm:h-[350px] md:h-[400px] mx-2 sm:mx-4"
    >
      <Image
        src={testimonial.image}
        alt={testimonial.name}
        fill
        className="object-cover rounded-lg sm:rounded-2xl shadow-lg"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-lg sm:rounded-2xl" />
      <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 flex flex-col gap-1 sm:gap-2">
        <p className="text-base sm:text-lg text-white font-medium">
          {testimonial.text}
        </p>
        <div className="flex flex-col">
          <p className="text-white font-semibold text-sm sm:text-base">
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
    <section className="w-full py-12 sm:py-16 md:py-20 bg-mainWhite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tighter text-center mb-8 sm:mb-12 md:mb-16 text-mainBlack">
          What Our Customers Say
        </h2>
        <EmblaCarousel
          slides={slides}
          options={OPTIONS}
          maxTranslateY={250}
          tweenFactorBase={0.2}
          className="w-full"
        />
      </div>
    </section>
  );
};

export default Gallery;
