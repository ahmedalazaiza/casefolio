import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const tagVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 type-caption transition-colors",
  {
    variants: {
      selected: {
        false: "border-border bg-elevated text-muted-foreground hover:text-foreground",
        true: "border-primary bg-accent text-accent-foreground",
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

type TagProps = ComponentProps<"span"> & VariantProps<typeof tagVariants>;

function Tag({ className, selected, ...props }: TagProps) {
  return <span data-slot="tag" className={cn(tagVariants({ selected }), className)} {...props} />;
}

export { Tag, tagVariants, type TagProps };

