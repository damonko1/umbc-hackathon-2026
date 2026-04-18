"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getPreferredTheme,
  type ThemeName,
} from "@/lib/theme";

const themeOptions = [
  { value: "light" as const, label: "Light", Icon: SunMedium },
  { value: "dark" as const, label: "Dark", Icon: MoonStar },
];

export function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const [theme, setTheme] = React.useState<ThemeName>("dark");

  React.useEffect(() => {
    const syncTheme = () => {
      const nextTheme = getPreferredTheme();
      applyTheme(nextTheme);
      setTheme(nextTheme);
      setMounted(true);
    };

    syncTheme();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextTheme = getPreferredTheme();
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setSelectedTheme = (nextTheme: ThemeName) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {}

    applyTheme(nextTheme);
    setTheme(nextTheme);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="fixed right-3 top-3 z-50 sm:right-4 sm:top-4">
      <div
        role="group"
        aria-label="Color theme"
        className="flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card)]/84 p-0.5 shadow-[0_10px_28px_var(--card-shadow)] backdrop-blur-md"
      >
        {themeOptions.map(({ value, label, Icon }) => {
          const active = theme === value;

          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={active}
              onClick={() => setSelectedTheme(value)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors sm:px-2.5 sm:py-1.5 sm:text-xs",
                active
                  ? "bg-[var(--foreground)] text-[var(--background)] shadow-[0_8px_18px_var(--card-shadow)]"
                  : "text-[var(--muted)] hover:bg-[var(--foreground)]/6 hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
