import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MetricDisplayProps {
  label: string;
  value: ReactNode;
  unit?: string;
  supportingText?: ReactNode;
  emphasis?: "standard" | "strong";
  className?: string;
}

export function MetricDisplay({
  label,
  value,
  unit,
  supportingText,
  emphasis = "standard",
  className,
}: MetricDisplayProps) {
  return (
    <dl
      className={cn(
        "min-w-0 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)] p-4 shadow-[var(--tl-shadow-sm)]",
        className,
      )}
    >
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--tl-ink-muted)]">
        {label}
      </dt>
      <dd className="mt-2">
        <span
          className={cn(
            "tl-tabular break-words font-bold tracking-[-0.03em] text-[var(--tl-ink)]",
            emphasis === "strong" ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl",
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="ml-1.5 text-sm font-semibold text-[var(--tl-ink-muted)] sm:text-base">
            {unit}
          </span>
        ) : null}
      </dd>
      {supportingText ? (
        <dd className="mt-1.5 text-sm leading-5 text-[var(--tl-ink-muted)]">
          {supportingText}
        </dd>
      ) : null}
    </dl>
  );
}
