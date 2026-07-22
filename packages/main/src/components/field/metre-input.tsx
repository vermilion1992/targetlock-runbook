"use client";

import { Minus, Plus } from "lucide-react";
import {
  useId,
  type FocusEventHandler,
  type InputHTMLAttributes,
} from "react";

import { Input } from "@/components/ui/input";
import { decimetres, decimetresToMetres, parseMetreInput } from "@/domain";
import { cn } from "@/lib/utils";

interface MetreInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "inputMode"
  > {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  helpText?: string;
  error?: string;
  min?: number;
  max?: number;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  containerClassName?: string;
}

function clampDecimetres(value: number, min?: number, max?: number): number {
  const minimum =
    min === undefined ? Number.NEGATIVE_INFINITY : Math.ceil(min * 10);
  const maximum =
    max === undefined ? Number.POSITIVE_INFINITY : Math.floor(max * 10);
  return Math.min(maximum, Math.max(minimum, value));
}

export function MetreInput({
  id,
  label,
  value,
  onValueChange,
  helpText,
  error,
  min,
  max,
  disabled,
  readOnly,
  required,
  onBlur,
  className,
  containerClassName,
  "aria-describedby": ariaDescribedBy,
  ...inputProps
}: MetreInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy = [ariaDescribedBy, helpText ? helpId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ");
  const controlsDisabled = disabled || readOnly;

  const stepValue = (direction: -1 | 1) => {
    const parsed = parseMetreInput(value);
    const startingValueDm = parsed.ok ? parsed.value : 0;
    const nextValueDm = clampDecimetres(
      startingValueDm + direction,
      min,
      max,
    );
    onValueChange(decimetresToMetres(decimetres(nextValueDm)).toFixed(1));
  };

  return (
    <div className={cn("w-full", containerClassName)}>
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm font-bold leading-5 text-[var(--tl-ink)]"
      >
        {label}
        {required ? (
          <span className="ml-1 text-[var(--tl-danger)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] gap-2">
        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => stepValue(-1)}
          aria-label={`Decrease ${label} by 0.1 metres`}
          className="flex size-12 items-center justify-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] text-[var(--tl-ink)]"
        >
          <Minus aria-hidden="true" className="size-5" strokeWidth={2.5} />
        </button>

        <div className="relative min-w-0">
          <Input
            {...inputProps}
            id={inputId}
            type="text"
            inputMode="decimal"
            step="0.1"
            pattern="-?[0-9]*([.,][0-9]?)?"
            autoComplete="off"
            value={value}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy || undefined}
            aria-errormessage={error ? errorId : undefined}
            onChange={(event) => onValueChange(event.target.value)}
            onBlur={onBlur}
            className={cn(
              "tl-tabular h-12 border-[var(--tl-border-strong)] bg-[var(--tl-surface)] pr-10 text-right text-lg font-bold text-[var(--tl-ink)] placeholder:text-[var(--tl-ink-muted)] focus-visible:border-[var(--tl-primary)] focus-visible:ring-2 focus-visible:ring-[var(--tl-primary)]/20",
              error &&
                "border-[var(--tl-danger)] focus-visible:border-[var(--tl-danger)] focus-visible:ring-[var(--tl-danger)]/20",
              className,
            )}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-[var(--tl-ink-muted)]"
          >
            m
          </span>
        </div>

        <button
          type="button"
          disabled={controlsDisabled}
          onClick={() => stepValue(1)}
          aria-label={`Increase ${label} by 0.1 metres`}
          className="flex size-12 items-center justify-center rounded-[var(--tl-radius-sm)] border border-[var(--tl-border-strong)] bg-[var(--tl-surface-raised)] text-[var(--tl-ink)]"
        >
          <Plus aria-hidden="true" className="size-5" strokeWidth={2.5} />
        </button>
      </div>

      {helpText ? (
        <p
          id={helpId}
          className="mt-2 text-sm leading-5 text-[var(--tl-ink-muted)]"
        >
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="mt-1 text-sm font-semibold leading-5 text-[var(--tl-danger)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
