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
    <div className="flex w-full flex-col gap-3">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        const panelId = `faq-panel-${idx}`;
        const triggerId = `faq-trigger-${idx}`;

        return (
          <div
            key={item.question}
            className={cn(
              "rounded-xl border transition-all duration-200",
              isOpen
                ? "border-[var(--cf-border-strong)] bg-[var(--cf-bg-elevated)]"
                : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] hover:border-[var(--cf-royal)]",
            )}
          >
            <h3 className="m-0">
              <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="v3-body-m-strong focus-visible:ring-ring/40 flex w-full items-center justify-between gap-4 rounded-xl px-5 py-5 text-left text-[var(--cf-text-primary)] outline-none focus-visible:ring-2 lg:px-6"
              >
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
                    isOpen
                      ? "bg-[var(--cf-royal)] text-[var(--cf-bg-accent)]"
                      : "border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-[var(--cf-text-primary)]",
                  )}
                >
                  {isOpen ? (
                    <Minus className="size-4" strokeWidth={2.25} />
                  ) : (
                    <Plus className="size-4" strokeWidth={2.25} />
                  )}
                </span>
              </button>
            </h3>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className="v3-body-m px-5 pb-5 text-[var(--cf-text-secondary)] lg:px-6 lg:pb-6"
              >
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
