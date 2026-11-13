"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

export interface FaqItem {
  question: string;
  answer: string;
}

export const LANDING_FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: "Who designs Casefolio templates?",
    answer:
      "The Casefolio team designs, maintains, and versions every template in-house so layouts stay responsive, cohesive, and export-ready. Free includes standard templates; Pro, Team, and Plus unlock the full Pro and Premium template library.",
  },
  {
    question: "Can I use my own colors, fonts, and custom domain?",
    answer:
      "Yes. Pro, Team, and Plus unlock custom fonts, brand color palettes, and custom section layouts. Plus also includes custom domains (such as work.youragency.com) and complete white-labeling.",
  },
  {
    question: "What export formats and sharing options do I get on each plan?",
    answer:
      "Free includes a Live Shareable Link plus PNG and PDF exports with a subtle Casefolio watermark. Pro ($9.99/mo or $7.99/mo billed annually) and Team ($6.99/seat/mo or $5.59/seat/mo billed annually) unlock watermark-free high-res PNG, PDF, and Behance 1400px exports. Plus ($99/mo or $79/mo billed annually) removes all Casefolio branding from PDF metadata, live links, and custom domains.",
  },
  {
    question: "How do seats work on Team vs. Plus?",
    answer:
      "Team supports 2 to 10 seats with dynamic per-seat billing, role-based permissions, a Shared Brand Kit, and private member workspaces hidden from Admins. Need 11 to 20 seats? Plus covers up to 20 seats at a flat monthly or annual rate with no per-seat math.",
  },
  {
    question: "What happens if I downgrade to Free or leave a team?",
    answer:
      "Your Case Studies are never deleted. When downgrading to Free with more than 1 Case Study, you choose which 1 active Case Study stays live and editable while the rest remain safely archived until you upgrade again. Departing team members retain access to a 90+ day private Recovery Portal.",
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
