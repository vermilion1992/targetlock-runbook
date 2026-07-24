"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import {
  backAriaLabel,
  backVisibleLabel,
  type RunbookBackTarget,
} from "@/components/navigation/runbook-page-back";
import { cn } from "@/lib/utils";

export function RunbookPageBackLink({
  target,
  className,
}: {
  target: RunbookBackTarget;
  className?: string;
}) {
  const ariaLabel = backAriaLabel(target);
  const { short, long } = backVisibleLabel(target.label);
  const classes = cn(
    "inline-flex box-border max-w-full items-center gap-2 rounded-[var(--tl-radius-md)] px-2 text-sm font-semibold text-[var(--tl-primary)] no-underline",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tl-primary)]",
    "hover:bg-[var(--tl-primary-soft)]",
    className,
  );
  const hitAreaStyle = { minHeight: 48, minWidth: 48 } as const;

  const content = (
    <>
      <ArrowLeft aria-hidden="true" className="size-5 shrink-0" />
      <span className="min-w-0 truncate sm:hidden">{short}</span>
      <span className="hidden min-w-0 truncate sm:inline">{long}</span>
    </>
  );

  if (target.onNavigate) {
    return (
      <button
        type="button"
        className={classes}
        style={hitAreaStyle}
        aria-label={ariaLabel}
        data-testid="runbook-page-back"
        onClick={() => target.onNavigate?.(target.href)}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={target.href}
      className={classes}
      style={hitAreaStyle}
      aria-label={ariaLabel}
      data-testid="runbook-page-back"
    >
      {content}
    </Link>
  );
}
