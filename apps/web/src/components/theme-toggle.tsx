"use client";

import { Clock, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { type ThemeModePreference, useThemeMode } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: ReadonlyArray<{
  id: ThemeModePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
  { id: "auto", label: "Auto", icon: Clock },
];

export function ThemeModeSelector({ className }: { className?: string }) {
  const { mode, setMode, resolvedTheme, mounted } = useThemeMode();

  const helperLabel =
    mode === "system"
      ? "Matches your system theme"
      : mode === "auto"
        ? `Auto · ${resolvedTheme === "dark" ? "Night (19:00–06:00)" : "Day (06:00–19:00)"}`
        : mode === "dark"
          ? "Dark mode active"
          : "Light mode active";

  return (
    <div
      data-testid="profile-theme-toggle"
      className={cn("flex flex-col gap-2", className)}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-semibold tracking-wider text-[var(--cf-text-tertiary)] uppercase">
          Appearance
        </span>
        <span className="font-mono text-[0.625rem] font-medium text-[var(--cf-text-secondary)] capitalize">
          {mounted ? mode : "system"}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Color theme mode"
        className="grid grid-cols-4 gap-1 rounded-[0.375rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] p-1"
      >
        {MODE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = mounted ? mode === opt.id : opt.id === "system";
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`theme-mode-${opt.id}`}
              onClick={() => setMode(opt.id)}
              className={cn(
                "focus-visible:ring-ring/40 inline-flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[0.25rem] px-1.5 py-1.5 text-[0.6875rem] font-medium transition-colors outline-none focus-visible:ring-2",
                active
                  ? "bg-[var(--cf-ink)] font-semibold text-[var(--cf-text-on-ink)]"
                  : "text-[var(--cf-text-secondary)] hover:bg-[var(--cf-bg-elevated)] hover:text-[var(--cf-text-primary)]",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[0.6875rem] leading-tight text-[var(--cf-text-tertiary)]">
        {mounted ? helperLabel : "Matches your system theme"}
      </p>
    </div>
  );
}

export function ThemeToggle({ className }: { className?: string } = {}) {
  const { resolvedTheme } = useTheme();
  const { setMode } = useThemeMode();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Toggle color theme"
      className={cn(className)}
      onClick={() => setMode(isDark ? "light" : "dark")}
    >
      <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  );
}
