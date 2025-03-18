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
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, index) => (
            <div
              className="flex-[0_0_100%]"
              key={index}
            >
              <div className={`w-full ${className || ""}`}>
                {slide}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 mt-6">
        <PrevButton
          className="w-10 h-10 bg-mainBlack text-mainWhite rounded-full flex items-center justify-center"
          onClick={onPrevButtonClick}
          disabled={prevBtnDisabled}
        />
        <NextButton
          className="w-10 h-10 bg-mainBlack text-mainWhite rounded-full flex items-center justify-center"
          onClick={onNextButtonClick}
          disabled={nextBtnDisabled}
        />
      </div>
    </div>
  );
};

const Gallery = () => {
  const OPTIONS: EmblaOptionsType = { 
    loop: true,
    align: "start"
  };
  
  const slides = CarouselSlidesData.map((testimonial) => (
    <div
      key={testimonial.id}
      className="relative h-[400px]"
    >
      <Image
        src={testimonial.image}
        alt={testimonial.name}
        fill
        className="object-cover"
        priority
      />
    </div>
  ));

  return (
    <section className="w-full py-16 bg-mainWhite">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-semibold text-center mb-10 text-mainBlack px-4">
          What Our Customers Say
        </h2>
        <EmblaCarousel
          slides={slides}
          options={OPTIONS}
          className="w-full"
        />
      </div>
    </section>
  );
};

export default Gallery;
