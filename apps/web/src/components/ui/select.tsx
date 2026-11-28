import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const SELECT_CONTROL_CLASS =
  "border-[var(--cf-lp-input-border)] bg-[var(--cf-lp-input-bg)] text-foreground selection:bg-primary selection:text-primary-foreground flex h-[2.5625rem] w-full min-w-0 rounded-[0.375rem] border px-3.5 py-2 text-[0.8125rem] transition-colors outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface disabled:text-tertiary disabled:opacity-70 focus-visible:border-[var(--cf-lp-ink)] focus-visible:ring-ring/20 focus-visible:ring-2 aria-invalid:border-destructive aria-invalid:ring-destructive/15";

function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(SELECT_CONTROL_CLASS, className)}
      {...props}
    >
      {children}
    </select>
  );
}

interface SelectFieldProps extends ComponentProps<"select"> {
  label: string;
  helperText?: string;
  error?: string;
}

function SelectField({
  label,
  helperText,
  error,
  id,
  disabled,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;
  const hasMessage = Boolean(error || helperText);

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className={cn(
          "type-caption",
          disabled ? "text-tertiary" : "text-foreground",
        )}
      >
        {label}
      </label>
      <Select
        id={selectId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        className={className}
        {...props}
      >
        {children}
      </Select>
      {hasMessage && (
        <p
          id={messageId}
          className={cn("type-caption", error ? "text-destructive" : "text-tertiary")}
        >
          {error ?? helperText}
        </p>
      )}
    </div>
  );
}

export { Select, SelectField, type SelectFieldProps };
