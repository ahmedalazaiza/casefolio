import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const avatarBadgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none",
  {
    variants: {
      tone: {
        inverse: "bg-inverse text-inverse-foreground",
        accent: "bg-accent text-accent-foreground",
        neutral: "bg-sunken text-foreground border border-border",
      },
      size: {
        sm: "size-8 type-caption",
        default: "size-9 type-caption",
        lg: "size-11 type-body-s-strong",
      },
    },
    defaultVariants: {
      tone: "inverse",
      size: "default",
    },
  },
);

export interface AvatarBadgeProps
  extends Omit<ComponentProps<"span">, "children">,
    VariantProps<typeof avatarBadgeVariants> {
  initials: string;
  src?: string | null;
  alt?: string;
}

export function AvatarBadge({
  initials,
  src,
  alt,
  tone,
  size,
  className,
  ...props
}: AvatarBadgeProps) {
  const formattedInitials = initials.trim().slice(0, 2).toUpperCase() || "CF";

  return (
    <span
      data-slot="avatar-badge"
      className={cn(avatarBadgeVariants({ tone, size }), className)}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt ?? formattedInitials}
          className="size-full object-cover"
        />
      ) : (
        <span>{formattedInitials}</span>
      )}
    </span>
  );
}

export { avatarBadgeVariants };

