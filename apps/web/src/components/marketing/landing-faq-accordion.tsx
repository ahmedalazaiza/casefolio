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
      "The Casefolio team designs, versions and uploads every template so layouts stay consistent, responsive and publication-ready.",
  },
  {
    question: "Can I use my own colors and fonts?",
    answer:
      "Yes. Every template exposes curated theme tokens — primary, secondary, background and text colors plus licensed heading and body font pairs — while preserving spacing and visual hierarchy.",
  },
  {
    question: "What can I export?",
    answer:
      "Free accounts can publish case studies and export watermarked long PNGs. Pro and Team unlock crisp, unwatermarked PNGs, Behance-ready 1400px slices and multi-page A4 PDFs rendered from the exact same canvas.",
  },
  {
    question: "What happens to published pages if I cancel?",
    answer:
      "Your projects and uploaded screenshots stay safe in your workspace. After the billing period ends, paid-only perks pause gracefully and you can still edit or export within Free plan limits.",
  },
  {
    question: "Do you support Mobile + Web in one case study?",
    answer:
      "Yes. Choose a Mobile + Web template when creating a project to showcase iOS/Android flows alongside responsive desktop browser frames in a single narrative.",
  },
];

export function LandingFaqAccordion({
  items = LANDING_FAQ_ITEMS,
}: {
  items?: readonly FaqItem[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        const panelId = `faq-panel-${idx}`;
        const triggerId = `faq-trigger-${idx}`;

        return (
          <div
            key={item.question}
            className="border-border bg-card overflow-hidden rounded-xl border transition-colors"
          >
            <h3 className="m-0">
              <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="text-foreground type-heading-s focus-visible:ring-ring/40 flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors outline-none focus-visible:ring-2"
              >
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="text-muted-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full"
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
                className="text-muted-foreground type-body-m px-6 pt-0 pb-6"
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

