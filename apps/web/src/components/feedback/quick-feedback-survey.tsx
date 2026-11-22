"use client";

import type { ProductFeedbackTrigger } from "@casefolio/db";
import { CheckCircle2, Loader2, Sparkles, Star, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CRITICAL_SENTIMENT_TAGS,
  FEATURE_REQUEST_OPTIONS,
  POSITIVE_SENTIMENT_TAGS,
  PRIMARY_USE_CASE_OPTIONS,
} from "@/lib/feedback/types";
import { cn } from "@/lib/utils";

export const OPEN_FEEDBACK_EVENT = "casefolio:open-feedback";

export function dispatchOpenFeedbackSurvey(triggerMoment: ProductFeedbackTrigger = "manual") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_FEEDBACK_EVENT, { detail: { triggerMoment } }),
  );
}

export function QuickFeedbackSurvey() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [triggerMoment, setTriggerMoment] = useState<ProductFeedbackTrigger>("manual");
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [primaryUseCase, setPrimaryUseCase] = useState<string>("");
  const [topFeatureRequest, setTopFeatureRequest] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/feedback", { method: "GET", cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          eligible?: boolean;
          triggerMoment?: ProductFeedbackTrigger | null;
        };
        if (!cancelled && json.eligible && json.triggerMoment) {
          setTriggerMoment(json.triggerMoment);
          setOpen(true);
        }
      } catch {
        // Silent background check failure
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    function handleManualOpen(event: Event) {
      const custom = event as CustomEvent<{ triggerMoment?: ProductFeedbackTrigger }>;
      setTriggerMoment(custom.detail?.triggerMoment ?? "manual");
      setSubmitted(false);
      setError(null);
      setOpen(true);
    }

    window.addEventListener(OPEN_FEEDBACK_EVENT, handleManualOpen);
    return () => {
      window.removeEventListener(OPEN_FEEDBACK_EVENT, handleManualOpen);
    };
  }, []);

  if (!open) return null;

  const activeRating = hoverRating || rating;
  const tagPool =
    rating >= 4 || rating === 0 ? POSITIVE_SENTIMENT_TAGS : CRITICAL_SENTIMENT_TAGS;

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 6),
    );
  }

  async function handleSnooze() {
    setOpen(false);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "snooze",
          triggerMoment,
        }),
      });
    } catch {
      // Ignore network issues on dismiss
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError("Please tap a star rating from 1 to 5.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          rating,
          triggerMoment,
          primaryUseCase: primaryUseCase || null,
          topFeatureRequest: topFeatureRequest || null,
          sentimentTags: selectedTags,
          comment: comment.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not save your feedback.");
        return;
      }
      setSubmitted(true);
      window.setTimeout(() => {
        setOpen(false);
      }, 1800);
    } catch {
      setError("Network error while sending feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside
      role="dialog"
      aria-label="Quick Casefolio experience survey"
      data-testid="quick-feedback-survey"
      className="fixed right-4 bottom-4 z-50 w-[min(23rem,calc(100vw-2rem))] rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-5 shadow-2xl"
    >
      {submitted ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2 className="text-success size-8" />
          <p className="type-heading-s text-[var(--cf-text-primary)]">
            Thank you for the feedback!
          </p>
          <p className="type-caption text-[var(--cf-text-secondary)]">
            Our founding team reads every rating to prioritize upcoming templates &amp; features.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--cf-royal-soft)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--cf-royal-text)]">
                <Sparkles className="size-3" />
                <span>20-sec quick survey</span>
              </span>
              <h2 className="type-body-m-strong mt-1 text-[var(--cf-text-primary)]">
                How is Casefolio working for you?
              </h2>
            </div>
            <button
              type="button"
              aria-label="Remind me later"
              data-testid="feedback-snooze-btn"
              onClick={handleSnooze}
              className="text-muted-foreground hover:text-foreground rounded-lg p-1"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* 5-Star Rating */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3 py-2">
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = activeRating >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                    aria-checked={rating === star}
                    role="radio"
                    data-testid={`feedback-star-${star}`}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="rounded-md p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        "size-6 transition-colors",
                        filled
                          ? "fill-amber-400 text-amber-400"
                          : "text-[var(--cf-text-tertiary)]",
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <span className="type-caption font-semibold text-[var(--cf-text-secondary)]">
              {rating > 0 ? `${rating} / 5` : "Tap stars"}
            </span>
          </div>

          {rating > 0 && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {tagPool.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors",
                        selected
                          ? "border-[var(--cf-royal)] bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                          : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)]",
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[0.6875rem] font-semibold">
                    Main goal with Casefolio
                  </Label>
                  <select
                    aria-label="Main goal with Casefolio"
                    value={primaryUseCase}
                    onChange={(e) => setPrimaryUseCase(e.target.value)}
                    className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                  >
                    <option value="">Select (optional)...</option>
                    {PRIMARY_USE_CASE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[0.6875rem] font-semibold">
                    What should we build next?
                  </Label>
                  <select
                    aria-label="What should we build next?"
                    value={topFeatureRequest}
                    onChange={(e) => setTopFeatureRequest(e.target.value)}
                    className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                  >
                    <option value="">Pick top priority (optional)...</option>
                    {FEATURE_REQUEST_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <Textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Anything we should improve or add? (optional)"
                  className="text-xs"
                />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-destructive text-xs font-medium">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSnooze}
            >
              Maybe later
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || rating === 0}
              data-testid="feedback-submit-btn"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              <span>Submit feedback</span>
            </Button>
          </div>
        </form>
      )}
    </aside>
  );
}
