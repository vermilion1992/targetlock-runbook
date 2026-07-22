"use client";

import { Laptop, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

type ThemeMode = "system" | "light" | "dark";

interface ThemeOption {
  value: ThemeMode;
  label: "System" | "Light" | "Dark";
  icon: LucideIcon;
}

const themeOptions: readonly ThemeOption[] = [
  { value: "system", label: "System", icon: Laptop },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeModeControl() {
  const { theme, setTheme } = useTheme();
  const activeTheme = theme ?? "system";

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex shrink-0 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border)] bg-[var(--tl-surface-sunken)] p-0.5"
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const active = activeTheme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-label={`${option.label} theme`}
            aria-pressed={active}
            title={`${option.label} theme`}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex size-11 min-h-11 min-w-11 items-center justify-center rounded-md border-0 transition-colors",
              active
                ? "bg-[var(--tl-surface)] text-[var(--tl-primary)] shadow-[var(--tl-shadow-sm)]"
                : "bg-transparent text-[var(--tl-ink-muted)]",
            )}
          >
            <Icon aria-hidden="true" className="size-[1.125rem]" />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
