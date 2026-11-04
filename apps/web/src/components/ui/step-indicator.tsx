import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type StepState = "done" | "current" | "upcoming";

export interface StepIndicatorProps extends ComponentProps<"div"> {
  step: number;
  label: string;
  state: StepState;
}

export function StepIndicator({
  step,
  label,
  state,
  className,
  ...props
}: StepIndicatorProps) {
  return (
    <div
      data-slot="step-indicator"
      data-state={state}
      className={cn("inline-flex items-center gap-2.5", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full type-caption",
          state === "done" && "bg-success text-success-foreground",
          state === "current" && "bg-inverse text-inverse-foreground",
          state === "upcoming" && "bg-sunken text-tertiary",
        )}
      >
        {state === "done" ? <Check className="size-3.5" /> : step}
      </span>
      <span
        className={cn(
          state === "current" && "text-foreground type-body-s-strong",
          state === "done" && "text-foreground type-body-s",
          state === "upcoming" && "text-tertiary type-body-s",
        )}
      >
        {label}
      </span>
    </div>
  );
}

