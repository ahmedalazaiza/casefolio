import { cva, type VariantProps } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-300 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-inverse text-inverse-foreground hover:bg-inverse/85",
        accent: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border border-border bg-elevated text-foreground shadow-xs hover:bg-surface",
        outline:
          "border border-border bg-elevated text-foreground shadow-xs hover:bg-surface",
        ghost: "bg-transparent text-foreground hover:bg-sunken",
        inverse: "bg-inverse text-inverse-foreground hover:bg-inverse/90",
        destructive:
          "bg-destructive-soft text-destructive hover:bg-destructive-soft/80",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2 type-body-s-strong",
        sm: "h-9 px-4 py-1.5 type-caption",
        lg: "h-12 px-7 py-3 type-body-m-strong",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? SlotPrimitive.Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
