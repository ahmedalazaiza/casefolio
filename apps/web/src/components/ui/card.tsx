import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "flex flex-col rounded-[0.5625rem] border transition-colors duration-200",
  {
    variants: {
      variant: {
        default:
          "border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] text-card-foreground",
        flat: "border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] text-card-foreground",
        surface: "border-[var(--cf-lp-card-border)] bg-[var(--cf-bg-surface)] text-foreground",
        inverse: "border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark)] text-[var(--cf-lp-dark-ink)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type CardProps = ComponentProps<"div"> & VariantProps<typeof cardVariants>;

function Card({ className, variant, ...props }: CardProps) {
  return <div data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />;
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("type-heading-s", className)} {...props} />;
}

function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-muted-foreground type-body-s", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6 pb-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 pb-6", className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardVariants };

