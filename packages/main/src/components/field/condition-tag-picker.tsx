"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

export interface ConditionTagOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface ConditionTagPickerProps {
  label: string;
  options: readonly ConditionTagOption[];
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  helpText?: string;
  disabled?: boolean;
  className?: string;
}

export function ConditionTagPicker({
  label,
  options,
  value,
  onValueChange,
  helpText,
  disabled = false,
  className,
}: ConditionTagPickerProps) {
  const generatedId = useId();
  const helpId = `${generatedId}-help`;

  const toggleOption = (optionValue: string) => {
    const selected = value.includes(optionValue);
    onValueChange(
      selected
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    );
  };

  return (
    <fieldset
      disabled={disabled}
      aria-describedby={helpText ? helpId : undefined}
      className={cn("min-w-0", className)}
    >
      <legend className="text-sm font-bold leading-5 text-[var(--tl-ink)]">
        {label}
      </legend>
      {helpText ? (
        <p id={helpId} className="mt-1 text-sm leading-5 text-[var(--tl-ink-muted)]">
          {helpText}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={disabled || option.disabled}
              onClick={() => toggleOption(option.value)}
              className={cn(
                "inline-flex min-h-11 max-w-full items-center gap-2 rounded-[var(--tl-radius-md)] border px-4 py-2 text-left text-sm font-semibold transition-colors",
                selected
                  ? "border-[var(--tl-primary)] bg-[var(--tl-primary-soft)] text-[var(--tl-primary)]"
                  : "border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-[var(--tl-ink)]",
              )}
            >
              {selected ? (
                <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={3} />
              ) : null}
              <span className="min-w-0">
                <span className="block leading-5">{option.label}</span>
                {option.description ? (
                  <span className="block text-xs font-normal leading-4 text-[var(--tl-ink-muted)]">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
