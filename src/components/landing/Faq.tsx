"use client";

import { siteConfig } from "@/lib/config";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Faq() {
  return (
    <section className="w-full py-8 md:py-16 lg:py-24 bg-mainBlack" id="faq">
      <div className="max-w-section mx-auto px-section">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 leading-tight text-mainWhite">
            Frequently Asked Questions
          </h2>
          <div className="flex items-center justify-center">
            <span className="text-mainOrange text-xl mr-2 hidden sm:inline">
              📷
            </span>
            <p className="text-mainWhite text-base">
              Full commercial rights and ownership of your AI-generated headshots
            </p>
          </div>
          <p className="text-mainWhite text-base mt-3">
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {siteConfig.faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-mainWhite rounded-lg overflow-hidden border-none"
              >
                <AccordionTrigger className="px-6 py-4 text-mainBlack hover:no-underline">
                  <span className="text-left font-semibold">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 text-mainBlack">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
