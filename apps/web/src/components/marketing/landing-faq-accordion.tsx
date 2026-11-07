"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

export interface FaqItem {
  question: string;
  answer: string;
}

export const LANDING_FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: "Who designs the templates?",
    answer:
      "The Casefolio team designs, versions and uploads every template so layouts stay consistent, responsive, and ready for live pages and exports. Free includes 3 Starter templates at launch; Pro and Teams unlock all eligible published templates.",
  },
  {
    question: "Can I use my own colors and fonts?",
    answer:
      "Yes. Every template exposes curated theme tokens — primary, secondary, background, and text colors plus licensed heading and body font pairs — while preserving spacing and visual hierarchy.",
  },
  {
    question: "What can I export on each plan?",
    answer:
      "Free includes 5 branded 1x PNG exports per month (up to 1,440 px). Pro (60/mo) and Teams (100 × S/mo) unlock clean, unbranded 1x and 2x PNGs (up to 2,880 px), multi-page A4 PDFs, and Behance-ready 1,400 px slices.",
  },
  {
    question: "How do private spaces work inside Casefolio Teams?",
    answer:
      "Every Teams member gets up to 5 private spaces that are hidden from Owners, Admins, and teammates by default — plus shared team spaces (10 × S) where the studio collaborates and Owners or Admins publish.",
  },
  {
    question: "What happens if I downgrade or leave a team?",
    answer:
      "Nothing is deleted immediately. On Pro → Free, you keep 1 chosen public page live while extra projects remain safe to edit or archive within Free limits. If you leave a Team workspace, your private spaces enter a ≥90-day personal Recovery Portal so you can copy projects to your Personal Workspace.",
  },
];

export function LandingFaqAccordion({
  items = LANDING_FAQ_ITEMS,
}: {
  items?: readonly FaqItem[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        const panelId = `faq-panel-${idx}`;
        const triggerId = `faq-trigger-${idx}`;

        return (
          <div
            key={item.question}
            className={`overflow-hidden rounded-3xl border transition-all duration-500 ${isOpen ? "border-border/70 bg-card shadow-card" : "border-transparent bg-surface hover:bg-sunken"}`}
          >
            <h3 className="m-0">
              <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="text-foreground type-heading-s focus-visible:ring-ring/40 flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors outline-none focus-visible:ring-2 sm:gap-6 sm:px-7 sm:py-6"
              >
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${isOpen ? "bg-inverse text-inverse-foreground rotate-180" : "bg-elevated text-foreground shadow-xs"}`}
                >
                  {isOpen ? (
                    <Minus className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </span>
              </button>
            </h3>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className="text-muted-foreground type-body-m max-w-2xl px-5 pt-0 pb-5 sm:px-7 sm:pb-7"
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
