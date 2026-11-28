"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { V3_FAQ_ITEMS } from "@/lib/marketing/v3-landing-data";
import { cn } from "@/lib/utils";

export interface FaqItem {
  question: string;
  answer: string;
}

export const LANDING_FAQ_ITEMS: readonly FaqItem[] = V3_FAQ_ITEMS;

export function LandingFaqAccordion({
  items = LANDING_FAQ_ITEMS,
}: {
  items?: readonly FaqItem[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="border-t border-[var(--cf-lp-border)]">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const triggerId = `faq-trigger-${index}`;
        const panelId = `faq-panel-${index}`;

        return (
          <article
            key={item.question}
            className={cn(
              "border-b border-[var(--cf-lp-border)] transition-colors",
              isOpen && "bg-[color-mix(in_srgb,var(--cf-lp-elevated)_48%,transparent)]",
            )}
          >
            <button
              id={triggerId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="focus-visible:ring-ring/40 flex w-full cursor-pointer items-center justify-between gap-5 py-6 text-left font-editorial text-[1.125rem] leading-[1.35] font-normal text-[var(--cf-lp-ink)] transition-colors outline-none hover:text-[var(--cf-lp-action)] focus-visible:ring-2"
            >
              <span>{item.question}</span>
              <span
                aria-hidden="true"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-[0.3125rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-elevated)] text-[var(--cf-lp-ink)]"
              >
                {isOpen ? (
                  <Minus className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )}
              </span>
            </button>

            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              hidden={!isOpen}
              className={cn(isOpen ? "pb-6" : "hidden")}
            >
              <p className="max-w-[44rem] text-[0.875rem] leading-[1.65] text-[var(--cf-lp-subtle)]">
                {item.answer}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
