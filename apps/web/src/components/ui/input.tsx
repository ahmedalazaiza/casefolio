import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-elevated text-foreground placeholder:text-tertiary selection:bg-primary selection:text-primary-foreground flex h-11 w-full min-w-0 rounded-lg border px-4 py-2.5 type-body-m transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface disabled:text-tertiary disabled:opacity-70",
        "focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-2",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/15",
        className,
      )}
      {...props}
    />
  );
}

interface InputFieldProps extends ComponentProps<"input"> {
  label: string;
  helperText?: string;
  error?: string;
}

function InputField({
  label,
  helperText,
  error,
  id,
  disabled,
  className,
  ...props
}: InputFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasMessage = Boolean(error || helperText);

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn(
          "type-caption",
          disabled ? "text-tertiary" : "text-foreground",
        )}
      >
        {label}
      </label>
      <Input
        id={inputId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        className={className}
        {...props}
      />
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

export { Input, InputField, type InputFieldProps };
