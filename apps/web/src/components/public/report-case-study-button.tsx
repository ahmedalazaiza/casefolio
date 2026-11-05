"use client";

import { Flag } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REPORT_CATEGORIES, type ReportCategory } from "@/lib/admin/moderation-types";

export function ReportCaseStudyButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("Spam or scam");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setSubmitted(false);
    setErrorMessage(null);
    setOpen(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          category,
          details: details.trim() || undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to submit report.");
        return;
      }

      setSubmitted(true);
      setDetails("");
    });
  }

  return (
    <>
      <div className="border-border bg-background flex w-full items-center justify-center border-t px-4 py-4">
        <button
          type="button"
          data-testid="report-case-study-trigger"
          onClick={handleOpen}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors outline-none type-caption focus-visible:ring-2"
        >
          <Flag className="size-3.5" />
          Report case study
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report case study</DialogTitle>
            <DialogDescription>
              Flag &ldquo;{projectName}&rdquo; for review by the Casefolio moderation team.
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-col gap-4 py-2">
              <div
                role="status"
                data-testid="report-submitted-confirmation"
                className="bg-success-soft text-success rounded-xl px-4 py-3 type-body-s"
              >
                Thank you. Your report has been added to our moderation queue for review.
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {errorMessage && (
                <div
                  role="alert"
                  className="bg-destructive-soft text-destructive rounded-xl px-3.5 py-2.5 type-caption"
                >
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="report-category" className="text-foreground type-body-s-strong">
                  Reason
                </label>
                <select
                  id="report-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ReportCategory)}
                  className="border-border bg-background text-foreground focus-visible:ring-ring/40 h-10 rounded-xl border px-3 outline-none type-body-s focus-visible:ring-2"
                >
                  {REPORT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="report-details" className="text-foreground type-body-s-strong">
                  Additional context <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  id="report-details"
                  rows={3}
                  maxLength={500}
                  placeholder="Describe why this page violates Casefolio's guidelines..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-tertiary focus-visible:ring-ring/40 rounded-xl border p-3 outline-none type-body-s focus-visible:ring-2"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Submitting..." : "Submit report"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
