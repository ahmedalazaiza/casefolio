"use client";

import { ThemeProvider as NextThemesProvider, useTheme, type ThemeProviderProps } from "next-themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeModePreference = "light" | "dark" | "system" | "auto";

const THEME_MODE_STORAGE_KEY = "cf-theme-mode";
const AUTO_LIGHT_START_HOUR = 6;
const AUTO_DARK_START_HOUR = 19;

export function resolveTimeBasedTheme(date: Date = new Date()): "light" | "dark" {
  const hour = date.getHours();
  return hour >= AUTO_LIGHT_START_HOUR && hour < AUTO_DARK_START_HOUR ? "light" : "dark";
}

interface ThemeModeContextValue {
  mode: ThemeModePreference;
  setMode: (next: ThemeModePreference) => void;
  resolvedTheme: "light" | "dark";
  mounted: boolean;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function ThemeModeSynchronizer({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode: ThemeModePreference;
}) {
  const { setTheme, resolvedTheme, theme } = useTheme();
  const [mode, setModeState] = useState<ThemeModePreference>(initialMode);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system" || saved === "auto") {
        setModeState(saved);
        return;
      }
      if (theme === "light" || theme === "dark" || theme === "system") {
        setModeState(theme);
      }
    } catch {
      // Ignore storage access failures in restricted environments
    }
  }, [theme]);

  useEffect(() => {
    if (!mounted) return;

    const applyMode = () => {
      if (mode === "auto") {
        setTheme(resolveTimeBasedTheme(new Date()));
      } else {
        setTheme(mode);
      }
    };

    applyMode();

    if (mode !== "auto") return;

    const intervalId = window.setInterval(applyMode, 60_000);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        applyMode();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [mode, mounted, setTheme]);

  const setMode = useCallback(
    (next: ThemeModePreference) => {
      setModeState(next);
      try {
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, next);
      } catch {
        // Ignore storage failures
      }
      if (next === "auto") {
        setTheme(resolveTimeBasedTheme(new Date()));
      } else {
        setTheme(next);
      }
    },
    [setTheme],
  );

  const normalizedResolved: "light" | "dark" =
    resolvedTheme === "dark" ? "dark" : "light";

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      setMode,
      resolvedTheme: normalizedResolved,
      mounted,
    }),
    [mode, setMode, normalizedResolved, mounted],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (ctx) {
    return ctx;
  }

  const fallbackMode: ThemeModePreference =
    theme === "dark" || theme === "light" || theme === "system" ? theme : "system";

  return {
    mode: fallbackMode,
    setMode: (next) => {
      setTheme(next === "auto" ? resolveTimeBasedTheme(new Date()) : next);
    },
    resolvedTheme: resolvedTheme === "dark" ? "dark" : "light",
    mounted: true,
  };
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const initialMode: ThemeModePreference =
    props.defaultTheme === "light" || props.defaultTheme === "dark"
      ? props.defaultTheme
      : props.enableSystem === false
        ? "light"
        : "system";

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeModeSynchronizer initialMode={initialMode}>{children}</ThemeModeSynchronizer>
    </NextThemesProvider>
  );
}
